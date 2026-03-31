"""Split merged PDFs into individual documents by type using heuristics + LLM fallback."""

import json
import logging
import re
import subprocess
from pathlib import Path

log = logging.getLogger("agents.doc_splitter")

# Document type signals — regex patterns for heuristic classification
_SIGNALS = {
    "INVOICE": [
        r"(?i)\bTAX\s+INVOICE\b", r"(?i)\bInvoice\s+N(o|umber|um)\b",
        r"(?i)\bA\.?B\.?N\.?\b", r"(?i)\bA\.?C\.?N\.?\b",
        r"(?i)\bAmount\s+Due\b", r"(?i)\bTotal\s+(Inc|Incl|Including)\b",
        r"(?i)\bInvoice\s+Date\b", r"(?i)\bPayment\s+Terms?\b",
    ],
    "CONTRACTOR_WORKSHEET": [
        r"(?i)\bContractor\s+Worksheet\b", r"(?i)\bService\s+Job\s+Sheet\b",
        r"(?i)\bCNR\b", r"(?i)\bJNZ\b",
    ],
    "WORK_ORDER": [
        r"(?i)\bWork\s+Order\b", r"(?i)\bWO-\d+",
    ],
    "INSTALLATION_WORKSHEET": [
        r"(?i)\bInstallation\s+Worksheet\b", r"(?i)\bSales\s+Order\b",
        r"(?i)\bDelivery\s+Date\b",
    ],
    "COMMERCIAL_INVOICE": [
        r"(?i)\bCommercial\s+Invoice\b", r"(?i)\bHS\s+Code\b",
        r"(?i)\bContainer\b",
    ],
}

# Map specific types to 4-bucket enum
_BUCKET_MAP = {
    "INVOICE": "INVOICE",
    "CONTRACTOR_WORKSHEET": "JOB_SHEET",
    "WORK_ORDER": "JOB_SHEET",
    "INSTALLATION_WORKSHEET": "SUPPORTING",
    "COMMERCIAL_INVOICE": "SUPPORTING",
}

# Minimum regex hits for high confidence
_HIGH_CONFIDENCE_THRESHOLD = 2


def _extract_page_texts(pdf_path: str) -> list[str]:
    """Extract text per page via pdftotext. Returns list of strings, one per page."""
    try:
        proc = subprocess.run(
            ["pdfinfo", pdf_path], capture_output=True, text=True, timeout=10
        )
        match = re.search(r"Pages:\s+(\d+)", proc.stdout)
        if not match:
            return []
        num_pages = int(match.group(1))
    except Exception as e:
        log.warning(f"pdfinfo failed: {e}")
        return []

    pages = []
    for i in range(1, num_pages + 1):
        try:
            proc = subprocess.run(
                ["pdftotext", "-layout", "-f", str(i), "-l", str(i), pdf_path, "-"],
                capture_output=True, text=True, timeout=10,
            )
            pages.append(proc.stdout if proc.returncode == 0 else "")
        except Exception:
            pages.append("")
    return pages


def _classify_page_heuristic(text: str) -> tuple[str | None, int]:
    """Classify a page by regex signals. Returns (doc_type, hit_count) or (None, 0)."""
    best_type, best_hits = None, 0
    for doc_type, patterns in _SIGNALS.items():
        hits = sum(1 for p in patterns if re.search(p, text))
        if hits > best_hits:
            best_type, best_hits = doc_type, hits
    return best_type, best_hits


def _group_pages_into_documents(classifications: list[dict]) -> list[dict]:
    """Group consecutive pages of same type into document ranges."""
    if not classifications:
        return []

    docs = []
    current = {
        "doc_type": classifications[0]["doc_type"],
        "bucket": classifications[0]["bucket"],
        "start_page": 1,
        "end_page": 1,
        "confidence": classifications[0]["confidence"],
    }

    for i, c in enumerate(classifications[1:], start=2):
        if c["doc_type"] == current["doc_type"]:
            current["end_page"] = i
            current["confidence"] = min(current["confidence"], c["confidence"])
        else:
            docs.append(current)
            current = {
                "doc_type": c["doc_type"],
                "bucket": c["bucket"],
                "start_page": i,
                "end_page": i,
                "confidence": c["confidence"],
            }
    docs.append(current)
    return docs


def _split_pdf(pdf_path: str, docs: list[dict], workspace: Path) -> list[dict]:
    """Physically split PDF into fragments using pypdf. Returns result list."""
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(pdf_path)
    stem = Path(pdf_path).stem
    attachments_dir = workspace / "attachments"
    attachments_dir.mkdir(parents=True, exist_ok=True)
    results = []

    for i, doc in enumerate(docs, start=1):
        writer = PdfWriter()
        for page_idx in range(doc["start_page"] - 1, doc["end_page"]):
            writer.add_page(reader.pages[page_idx])

        out_name = f"{stem}_doc{i}_{doc['bucket'].lower()}.pdf"
        out_path = attachments_dir / out_name
        with open(out_path, "wb") as f:
            writer.write(f)

        results.append({
            "file_path": str(out_path),
            "document_type": doc["bucket"],
            "start_page": doc["start_page"],
            "end_page": doc["end_page"],
            "confidence": doc["confidence"],
            "original_file": pdf_path,
        })

    return results


async def _classify_pages_llm(page_texts: list[str], workspace: Path, model: str) -> list[dict]:
    """LLM fallback for ambiguous pages. Returns classifications list."""
    from agents.runner import run_claude_step, prepare_step

    pages_summary = []
    for i, text in enumerate(page_texts, start=1):
        # Truncate each page to ~500 chars for the prompt
        snippet = text[:500].strip() if text.strip() else "(empty/no text)"
        pages_summary.append(f"--- PAGE {i} ---\n{snippet}")

    prompt_text = f"""You are classifying pages of a merged PDF document.

Each page belongs to exactly one document type:
- INVOICE: Tax invoices, with Invoice Number, ABN, amounts
- CONTRACTOR_WORKSHEET: Contractor Worksheets, Service Job Sheets (CNR, JNZ numbers)
- WORK_ORDER: Work Orders (WO- numbers)
- INSTALLATION_WORKSHEET: Installation Worksheets, Sales Orders, Delivery Dates
- COMMERCIAL_INVOICE: Commercial Invoices with HS Codes, Container info
- OTHER: Cover letters, remittance advice, quotes, anything else

Page contents:
{"\\n".join(pages_summary)}
"""

    schema = {
        "type": "object",
        "properties": {
            "pages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "page": {"type": "integer"},
                        "doc_type": {"type": "string"},
                        "confidence": {"type": "number"},
                    },
                    "required": ["page", "doc_type", "confidence"],
                },
            }
        },
        "required": ["pages"],
    }

    prepare_step(workspace, prompt_text, schema)
    from agents.runner import PROMPT_TEXT  # reuse standard invocation prompt
    # Use a step-specific prompt that references workspace files
    invoke_prompt = (
        "Read PROMPT.md for instructions. "
        "Output your analysis as JSON matching the schema in OUTPUT_SCHEMA.json. "
        "Return ONLY the JSON object, no other text."
    )
    success, result, error = await run_claude_step(
        "splitter", "split_classify", str(workspace), invoke_prompt, model=model,
    )

    if not success or not result:
        log.warning(f"LLM classification failed: {error}")
        # Fall back to all OTHER
        return [{"doc_type": "OTHER", "bucket": "OTHER", "confidence": 0.3} for _ in page_texts]

    classifications = []
    for page_info in result.get("pages", []):
        doc_type = page_info.get("doc_type", "OTHER")
        bucket = _BUCKET_MAP.get(doc_type, "OTHER")
        classifications.append({
            "doc_type": doc_type,
            "bucket": bucket,
            "confidence": page_info.get("confidence", 0.5),
        })

    # Pad if LLM returned fewer pages than expected
    while len(classifications) < len(page_texts):
        classifications.append({"doc_type": "OTHER", "bucket": "OTHER", "confidence": 0.3})

    return classifications


async def split_merged_pdf(pdf_path: str, workspace: Path, model: str = None) -> list[dict]:
    """Split a merged PDF into individual documents.

    Returns list of dicts: [{file_path, document_type, start_page, end_page, confidence, original_file}]
    If no split needed, returns single-element list with original file.
    """
    import os
    if model is None:
        model = os.environ.get("CLAUDE_MODEL", "claude-opus-4-6")

    path = Path(pdf_path)

    # Non-PDF: pass through
    if path.suffix.lower() != ".pdf":
        return [{"file_path": pdf_path, "document_type": "OTHER",
                 "start_page": 1, "end_page": 1, "confidence": 1.0, "original_file": pdf_path}]

    # Extract text per page
    try:
        page_texts = _extract_page_texts(pdf_path)
    except Exception as e:
        log.error(f"Failed to extract text from {pdf_path}: {e}")
        return [{"file_path": pdf_path, "document_type": "OTHER",
                 "start_page": 1, "end_page": 1, "confidence": 0.0,
                 "original_file": pdf_path, "error": f"Corrupted PDF: {e}"}]

    num_pages = len(page_texts)

    # Edge case: empty extraction (protected/scanned)
    if num_pages == 0 or all(len(t.strip()) < 50 for t in page_texts):
        return [{"file_path": pdf_path, "document_type": "PROTECTED_OR_SCANNED",
                 "start_page": 1, "end_page": max(num_pages, 1), "confidence": 0.0,
                 "original_file": pdf_path, "flag": "PROTECTED_OR_SCANNED"}]

    # Edge case: too large
    if num_pages > 50:
        return [{"file_path": pdf_path, "document_type": "OTHER",
                 "start_page": 1, "end_page": num_pages, "confidence": 0.0,
                 "original_file": pdf_path, "flag": "TOO_LARGE"}]

    # Edge case: single page
    if num_pages == 1:
        doc_type, hits = _classify_page_heuristic(page_texts[0])
        bucket = _BUCKET_MAP.get(doc_type or "OTHER", "OTHER")
        return [{"file_path": pdf_path, "document_type": bucket,
                 "start_page": 1, "end_page": 1,
                 "confidence": 0.9 if hits >= _HIGH_CONFIDENCE_THRESHOLD else 0.5,
                 "original_file": pdf_path}]

    # Heuristic pass
    classifications = []
    all_confident = True
    for text in page_texts:
        doc_type, hits = _classify_page_heuristic(text)
        if doc_type and hits >= _HIGH_CONFIDENCE_THRESHOLD:
            bucket = _BUCKET_MAP.get(doc_type, "OTHER")
            classifications.append({"doc_type": doc_type, "bucket": bucket, "confidence": 0.9})
        else:
            all_confident = False
            classifications.append({"doc_type": doc_type or "OTHER",
                                     "bucket": _BUCKET_MAP.get(doc_type or "OTHER", "OTHER"),
                                     "confidence": 0.3})

    # LLM fallback if any pages are ambiguous
    if not all_confident:
        log.info(f"Heuristic ambiguous for {path.name}, using LLM fallback")
        classifications = await _classify_pages_llm(page_texts, workspace, model)

    # Group into documents
    docs = _group_pages_into_documents(classifications)

    # Single document type detected — no split needed
    if len(docs) == 1:
        return [{"file_path": pdf_path, "document_type": docs[0]["bucket"],
                 "start_page": 1, "end_page": num_pages,
                 "confidence": docs[0]["confidence"], "original_file": pdf_path}]

    # Physical split
    try:
        results = _split_pdf(pdf_path, docs, workspace)
    except Exception as e:
        log.error(f"PDF split failed for {path.name}: {e}")
        return [{"file_path": pdf_path, "document_type": "OTHER",
                 "start_page": 1, "end_page": num_pages, "confidence": 0.0,
                 "original_file": pdf_path, "error": f"Split failed: {e}"}]

    log.info(f"Split {path.name} into {len(results)} documents: "
             + ", ".join(f"{r['document_type']}(p{r['start_page']}-{r['end_page']})" for r in results))
    return results
