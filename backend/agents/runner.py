"""Generic claude -p runner with workspace management, timeout, process group cleanup."""

import asyncio
import json
import logging
import os
import signal
import time
import uuid
from pathlib import Path

log = logging.getLogger("agents.runner")

WORKSPACE_ROOT = Path(__file__).parent.parent / "workspaces"
TIMEOUT_SECONDS = 300  # 5 min hard ceiling
MAX_TURNS = 50
DEFAULT_MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-4-6")

PROMPT_TEXT = (
    "Read PROMPT.md for your instructions and OUTPUT_SCHEMA.json for the expected output format. "
    "Follow the file-reading instructions in PROMPT.md exactly — read only the files it tells you to read. "
    "Return ONLY the JSON object, no other text."
)

RESUME_PROMPT_TEXT = (
    "PROMPT.md and OUTPUT_SCHEMA.json have been updated with new step instructions. "
    "Read PROMPT.md for the new task. Follow its file-reading instructions exactly. "
    "Return ONLY the JSON object, no other text."
)


async def run_claude_step(
    case_id: str,
    step_name: str,
    workspace: str,
    prompt: str,
    timeout: int = TIMEOUT_SECONDS,
    model: str = DEFAULT_MODEL,
    session_id: str | None = None,
) -> tuple[bool, dict | None, str | None, str | None]:
    """Invoke claude -p in workspace. Returns (success, result_dict, error_msg, session_id).

    If session_id is provided, resumes that session (--resume) instead of starting fresh.
    Always returns the session_id for chaining to the next step.
    """
    cmd = ["claude", "-p", prompt, "--output-format", "json", "--max-turns", str(MAX_TURNS), "--model", model]
    if session_id:
        cmd.extend(["--resume", session_id])
    else:
        # Fresh session — assign a unique session ID so we can resume later
        session_id = str(uuid.uuid4())
        cmd.extend(["--session-id", session_id])

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=workspace,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        preexec_fn=os.setsid,
    )

    pid = proc.pid
    start = time.time()
    mode = "resume" if "--resume" in cmd else "fresh"
    log.info(f"[{case_id}/{step_name}] Started claude -p, PID={pid}, mode={mode}, session={session_id[:8]}, model={model}, cwd={Path(workspace).name}")

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        try:
            os.killpg(os.getpgid(pid), signal.SIGKILL)
        except ProcessLookupError:
            pass
        save_debug(workspace, step_name, "TIMEOUT", None, None)
        return False, None, f"Timed out after {timeout}s (PID {pid} killed)", session_id

    duration_ms = int((time.time() - start) * 1000)

    if proc.returncode != 0:
        save_debug(workspace, step_name, "PROCESS_ERROR", stdout, stderr)
        return False, None, f"Exit code {proc.returncode}: {stderr.decode()[:500]}", session_id

    # Parse CLI structured output
    try:
        session_out = json.loads(stdout)
    except json.JSONDecodeError:
        save_debug(workspace, step_name, "PARSE_ERROR", stdout, stderr)
        return False, None, "stdout was not valid JSON", session_id

    if session_out.get("is_error"):
        save_debug(workspace, step_name, "AGENT_ERROR", stdout, stderr)
        return False, None, f"Agent error: {session_out.get('result', 'unknown')}", session_id

    # Capture session_id from output if available
    returned_sid = session_out.get("session_id", session_id)

    # Parse the agent's actual JSON response (may be wrapped in ```json fences)
    raw_result = session_out.get("result", "")
    # Strip markdown code fences if present
    if "```json" in raw_result:
        raw_result = raw_result.split("```json", 1)[1].rsplit("```", 1)[0]
    elif "```" in raw_result:
        raw_result = raw_result.split("```", 1)[1].rsplit("```", 1)[0]
    raw_result = raw_result.strip()
    try:
        result = json.loads(raw_result)
    except (json.JSONDecodeError, KeyError):
        # Fallback: extract first { ... } block (handles text preamble before JSON)
        brace_start = raw_result.find("{")
        if brace_start > 0:
            try:
                result = json.loads(raw_result[brace_start:])
            except (json.JSONDecodeError, KeyError):
                save_debug(workspace, step_name, "RESULT_PARSE_ERROR", stdout, stderr)
                return False, None, f"Agent output was not valid JSON: {raw_result[:200]}", returned_sid
        else:
            save_debug(workspace, step_name, "RESULT_PARSE_ERROR", stdout, stderr)
            return False, None, f"Agent output was not valid JSON: {raw_result[:200]}", returned_sid

    # Success
    save_debug(workspace, step_name, "SUCCESS", stdout, stderr)
    results_dir = Path(workspace) / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / f"{step_name}.json").write_text(json.dumps(result, indent=2))
    # Log result summary per step type
    summary = ""
    if step_name == "classify":
        summary = f"classification={result.get('classification')}"
    elif step_name == "categorize":
        docs = result.get("documents", [])
        present = [d["type"] for d in docs if d.get("status") == "PRESENT"]
        missing = [d["type"] for d in docs if d.get("status") == "MISSING"]
        summary = f"category={result.get('category')}, entity={result.get('entity')}, poType={result.get('poType')}, freightType={result.get('freightType')}, docs_present={present}, docs_missing={missing}"
    elif step_name == "extract":
        fields = result.get("fields", [])
        inv_count = sum(1 for f in fields if f.get("doc") == "Invoice")
        sup_docs = list(set(f.get("doc") for f in fields if f.get("doc") != "Invoice"))
        li_count = len(result.get("lineItems", []))
        summary = f"fields={len(fields)} (invoice={inv_count}, supporting={sup_docs}), lineItems={li_count}"
    elif step_name == "validate":
        rules = result.get("results", [])
        summary = f"rules={len(rules)}, pass={sum(1 for r in rules if r.get('status')=='PASS')}, fail={sum(1 for r in rules if r.get('status')=='FAIL')}"
    log.info(f"[{case_id}/{step_name}] Completed in {duration_ms}ms — {summary}")
    return True, result, None, returned_sid


def save_debug(workspace: str, step_name: str, status: str, stdout: bytes | None, stderr: bytes | None):
    """Save raw stdout/stderr to workspace for debugging."""
    results_dir = Path(workspace) / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    debug = {
        "status": status,
        "stdout": stdout.decode(errors="replace")[:10000] if stdout else None,
        "stderr": stderr.decode(errors="replace")[:5000] if stderr else None,
    }
    (results_dir / f"{step_name}_debug.json").write_text(json.dumps(debug, indent=2))


def create_workspace(case_id: str) -> Path:
    """Create case workspace directory structure."""
    ws = WORKSPACE_ROOT / case_id
    (ws / "attachments").mkdir(parents=True, exist_ok=True)
    (ws / "master-data").mkdir(exist_ok=True)
    (ws / "results").mkdir(exist_ok=True)
    return ws


def prepare_step(workspace: Path, prompt_text: str, output_schema: dict | None, field_config: dict | None = None):
    """Write PROMPT.md, OUTPUT_SCHEMA.json, and optionally FIELD_LIST.md to workspace."""
    (workspace / "PROMPT.md").write_text(prompt_text)
    if output_schema:
        (workspace / "OUTPUT_SCHEMA.json").write_text(json.dumps(output_schema, indent=2))
    if field_config:
        inv_count = len(field_config.get("invoiceFields") or [])
        sup_types = list((field_config.get("supportingFields") or {}).keys())
        sup_count = sum(len(v) for v in (field_config.get("supportingFields") or {}).values())
        rule_count = len(field_config.get("validationRules") or [])
        log.info(f"[prepare_step] FIELD_LIST.md: {inv_count} invoice fields, {sup_count} supporting fields ({sup_types}), {rule_count} validation rules")
        lines = [
            "# Field Definitions for Extraction\n",
            'Return a flat `fields` array. For each field below, output:',
            '  {"doc": "<Document Type>", "key": "<Key>", "text": "<exact text from document>", "value": <normalized value or null>, "page": <page number>, "file": "<filename>"}\n',
            '- `text` = exact text as it appears on the document (for OCR matching)',
            '- `value` = normalized value (ISO dates like 2026-03-17, cleaned numbers like 109.09, canonical formats)',
            '- `page` = page number within the file (starting from 1)',
            '- `file` = filename from the attachments directory',
            '- If a field is present on the document but blank, set value to null and include the page/file where you looked',
            '- If a field is not found on any document, omit it entirely from the output\n',
            'Document type for Invoice Fields = "Invoice"',
            'Document type for supporting fields = the section header below (e.g., "Contractor Worksheet")\n',
        ]
        # Invoice fields
        inv = field_config.get("invoiceFields") or []
        if inv:
            lines.append("## Invoice Fields\n")
            lines.append("| # | Key | Label | Type | Required | Validation | Source Hint |")
            lines.append("|---|-----|-------|------|----------|------------|-------------|")
            for i, f in enumerate(inv, 1):
                lines.append(f"| {i} | {f['key']} | {f['label']} | {f['type']} | {f['required']} | {f.get('validation','')} | {f.get('sourceHint','')} |")
            lines.append("")
        # Supporting fields by doc type
        sup = field_config.get("supportingFields") or {}
        for doc_type, fields in sup.items():
            if fields:
                lines.append(f"## Supporting: {doc_type}\n")
                lines.append("| # | Key | Label | Type | Required | Validation | Source Hint |")
                lines.append("|---|-----|-------|------|----------|------------|-------------|")
                for i, f in enumerate(fields, 1):
                    lines.append(f"| {i} | {f['key']} | {f['label']} | {f['type']} | {f['required']} | {f.get('validation','')} | {f.get('sourceHint','')} |")
                lines.append("")
        # Validation rules
        val = field_config.get("validationRules") or []
        if val:
            lines.append("## Validation Rules\n")
            lines.append("| Rule ID | Name | Condition | Severity | Action |")
            lines.append("|---------|------|-----------|----------|--------|")
            for r in val:
                lines.append(f"| {r['ruleId']} | {r['ruleName']} | {r['condition']} | {r['severity']} | {r['action']} |")
            lines.append("")
        (workspace / "FIELD_LIST.md").write_text("\n".join(lines))


def write_master_data(workspace: Path, db):
    """Snapshot master data into workspace for self-contained agent context."""
    from models import Vendor, InvoiceCategoryConfig, ServiceRateCard, FreightRateCard, ApprovalRule

    md_dir = workspace / "master-data"
    md_dir.mkdir(exist_ok=True)

    vendors = [v.to_dict() for v in db.query(Vendor).filter(Vendor.is_active == True).all()]
    (md_dir / "vendors.json").write_text(json.dumps(vendors, indent=2))

    configs = [c.to_dict() for c in db.query(InvoiceCategoryConfig).filter(InvoiceCategoryConfig.is_active == True).all()]
    (md_dir / "category-config.json").write_text(json.dumps(configs, indent=2))

    svc_rates = [r.to_dict() for r in db.query(ServiceRateCard).filter(ServiceRateCard.is_active == True).all()]
    (md_dir / "service-rate-cards.json").write_text(json.dumps(svc_rates, indent=2))

    frt_rates = [r.to_dict() for r in db.query(FreightRateCard).filter(FreightRateCard.is_active == True).all()]
    (md_dir / "freight-rate-cards.json").write_text(json.dumps(frt_rates, indent=2))

    rules = [r.to_dict() for r in db.query(ApprovalRule).filter(ApprovalRule.is_active == True).all()]
    (md_dir / "approval-rules.json").write_text(json.dumps(rules, indent=2))


def kill_orphaned_claude_processes():
    """Startup reaper: kill leftover claude processes from previous crashes."""
    import subprocess
    try:
        result = subprocess.run(
            ["pgrep", "-f", "claude.*-p.*--output-format"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            pids = result.stdout.strip().split("\n")
            for pid_str in pids:
                pid = int(pid_str.strip())
                log.warning(f"Killing orphaned claude process PID={pid}")
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
    except Exception as e:
        log.warning(f"Orphan reaper failed: {e}")
