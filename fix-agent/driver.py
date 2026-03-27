#!/usr/bin/env python3
"""
Autonomous bug-fix driver for Johnson AP.
State machine that spawns claude -p agents per step.

Usage:
    python driver.py T-J003          # Process ticket (NEW → FIXING → IN_REVIEW)
    python driver.py T-J003 --check  # Check for reporter response (IN_REVIEW → MERGE)
    python driver.py --cleanup       # Kill all fix servers
"""
import json, os, sys, subprocess, sqlite3, re, time
from pathlib import Path
from datetime import datetime, timezone

BASE = Path(__file__).parent
STATE_DIR = BASE / "state"
PROMPTS_DIR = BASE / "prompts"
PROJECT_DIR = BASE.parent
DB_PATH = "/home/ubuntu/dev/aistra-assistant/projects/projects.db"
SCREENSHOTS_DIR = Path("/home/ubuntu/dev/aistra-assistant/downloads/feedback")
CADDY_FILE = Path("/etc/caddy/Caddyfile")
STOP_FILE = BASE / "STOP"
LOG = BASE / "driver.log"
BASE_URL = "https://chat.dev.fiscalix.com"
TIMEOUT_ASSESS = 300   # 5 min
TIMEOUT_FIX = 600      # 10 min
TIMEOUT_MERGE = 120    # 2 min
PORT_MIN, PORT_MAX = 5190, 5199

STATE_DIR.mkdir(exist_ok=True)
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def log(msg):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def load_state(tid):
    p = STATE_DIR / f"{tid}.json"
    if p.exists():
        return json.loads(p.read_text())
    return {"ticket_id": tid, "state": "NEW", "branch": None, "port": None,
            "retry_count": 0, "max_retries": 2, "slug": None,
            "created_at": now(), "updated_at": now(),
            "error": None, "stop_reason": None}


def save_state(s):
    s["updated_at"] = now()
    (STATE_DIR / f"{s['ticket_id']}.json").write_text(json.dumps(s, indent=2))
    log(f"{s['ticket_id']}: → {s['state']}")


def now():
    return datetime.now(timezone.utc).isoformat()


def read_ticket(tid):
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (tid,)).fetchone()
    db.close()
    if not row:
        raise ValueError(f"Ticket {tid} not found")
    return dict(row)


def check_comments(tid, since):
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    rows = db.execute(
        "SELECT * FROM task_updates WHERE task_id = ? AND timestamp > ? AND author != 'Fix Agent' ORDER BY timestamp DESC",
        (tid, since)).fetchall()
    db.close()
    return [dict(r) for r in rows]


def is_approval(text):
    return any(w in text.lower() for w in ["approved", "looks good", "fixed", "lgtm", "verified", "yes"])


def slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')[:30]


def find_free_port():
    for port in range(PORT_MIN, PORT_MAX + 1):
        r = subprocess.run(["lsof", "-ti", f":{port}"], capture_output=True, text=True)
        if not r.stdout.strip():
            return port
    raise RuntimeError("No free ports in 5190-5199")


def render(template, **kw):
    t = (PROMPTS_DIR / template).read_text()
    for k, v in kw.items():
        t = t.replace(f"{{{k}}}", str(v or ""))
    return t


def run_claude(prompt, timeout=TIMEOUT_FIX):
    log(f"  → claude -p (timeout={timeout}s)")
    try:
        r = subprocess.run(
            ["claude", "-p", "--dangerously-skip-permissions", prompt],
            capture_output=True, text=True, timeout=timeout,
            cwd=str(PROJECT_DIR))
        log(f"  ← exit code {r.returncode}")
        return r.stdout + "\n" + r.stderr
    except subprocess.TimeoutExpired:
        log(f"  ← TIMEOUT")
        return "STATUS:TSC_FAIL"
    except Exception as e:
        log(f"  ← ERROR: {e}")
        return ""


def status_of(output):
    m = re.findall(r'STATUS:(\w+)', output)
    return m[-1] if m else None


def add_caddy_route(tid, port):
    route = f"/fix-{tid}"
    caddy = CADDY_FILE.read_text()
    if route in caddy:
        return  # Already exists
    block = f"\n\thandle {route} {{\n\t\tredir {route}/ permanent\n\t}}\n\n\thandle {route}/* {{\n\t\treverse_proxy localhost:{port}\n\t}}\n"
    marker = "\thandle /johnson-api"
    if marker in caddy:
        caddy = caddy.replace(marker, block + marker, 1)  # Only first occurrence
        CADDY_FILE.write_text(caddy)
        subprocess.run(["sudo", "systemctl", "reload", "caddy"], capture_output=True)
        log(f"  Caddy: {route} → :{port}")


def remove_caddy_route(tid):
    route = f"/fix-{tid}"
    caddy = CADDY_FILE.read_text()
    if route not in caddy:
        return
    lines = caddy.split("\n")
    out, skip = [], False
    for line in lines:
        if f"handle {route}" in line:
            skip = True; continue
        if skip and line.strip() == "}":
            skip = False; continue
        if not skip:
            out.append(line)
    CADDY_FILE.write_text("\n".join(out))
    subprocess.run(["sudo", "systemctl", "reload", "caddy"], capture_output=True)


def update_ticket(tid, status=None, comment=None):
    db = sqlite3.connect(DB_PATH)
    if status:
        db.execute("UPDATE tasks SET status = ? WHERE id = ?", (status, tid))
    if comment:
        db.execute(
            """INSERT INTO task_updates (id, task_id, project_id, timestamp, update_type, content, author)
            VALUES (?, ?, 'johnson-ap', datetime('now'), 'comment', ?, 'Fix Agent')""",
            (f"upd-{tid}-{int(time.time())}", tid, comment))
    db.commit()
    db.close()


def cleanup(tid, port=None):
    if port:
        subprocess.run(f"lsof -ti:{port} | xargs kill -9 2>/dev/null", shell=True, capture_output=True)
    remove_caddy_route(tid)
    log(f"  Cleaned up fix-{tid}")


# ─── State Machine ───

def run(tid):
    if STOP_FILE.exists():
        log("STOP file. Exiting."); return

    s = load_state(tid)
    log(f"─ {tid} state={s['state']}")

    if s["state"] == "NEW":
        t = read_ticket(tid)
        s["slug"] = slugify(t["title"])
        prompt = render("assess.md", ticket_id=tid, title=t["title"],
                        description=t.get("description", ""))
        out = run_claude(prompt, TIMEOUT_ASSESS)
        st = status_of(out)
        if st == "FIXABLE":
            s["state"] = "FIXING"; save_state(s); run(tid)
        elif st == "NEEDS_CLARITY":
            s["state"] = "NEEDS_CLARITY"; s["stop_reason"] = "Needs clarity"; save_state(s)
        else:
            s["state"] = "ESCALATED"; s["stop_reason"] = f"Assess: {st}"; save_state(s)

    elif s["state"] == "FIXING":
        t = read_ticket(tid)
        port = find_free_port()
        slug = s.get("slug", slugify(t["title"]))
        retry_ctx = ""
        if s.get("rejection_feedback"):
            retry_ctx = f"## Previous fix was rejected\nReporter said: {s['rejection_feedback']}\nFix what they described."

        prompt = render("fix.md", ticket_id=tid, ticket_id_lower=tid.lower(),
                        title=t["title"], title_short=t["title"][:60],
                        description=t.get("description", ""), slug=slug,
                        retry_context=retry_ctx, port=str(port))
        out = run_claude(prompt, TIMEOUT_FIX)
        st = status_of(out)

        if st == "FIXED":
            branch = f"fix/{tid.lower()}-{slug}"
            # Add Caddy route for the fix server the agent started
            add_caddy_route(tid, port)
            test_url = f"{BASE_URL}/fix-{tid}/"
            s.update(state="IN_REVIEW", branch=branch, port=port, test_url=test_url)
            save_state(s)
            update_ticket(tid, status="in_progress",
                comment=f"Fix deployed for testing.\n\n"
                        f"**Test URL:** {test_url}\n"
                        f"**Branch:** `{branch}`\n"
                        f"**Screenshot:** {BASE_URL}/feedback-screenshots/{tid}-fixed.png\n\n"
                        f"Please verify and comment \"approved\" or describe what needs to change.")
            log(f"  Fix deployed at {test_url}")
        elif st == "TSC_FAIL":
            s["retry_count"] += 1
            if s["retry_count"] >= s["max_retries"]:
                s["state"] = "ESCALATED"; s["stop_reason"] = "TSC failed"; save_state(s)
            else:
                save_state(s); run(tid)
        else:
            s["state"] = "ESCALATED"; s["stop_reason"] = f"Fix: {st}"; save_state(s)

    elif s["state"] == "IN_REVIEW":
        comments = check_comments(tid, s["updated_at"])
        if not comments:
            log("  No response yet."); return
        latest = comments[0]["content"]
        if is_approval(latest):
            s["state"] = "MERGING"; save_state(s); run(tid)
        else:
            s["retry_count"] += 1
            if s["retry_count"] >= s["max_retries"]:
                s["state"] = "ESCALATED"; s["stop_reason"] = "Max retries"
                cleanup(tid, s.get("port")); save_state(s)
            else:
                s["state"] = "FIXING"; s["rejection_feedback"] = latest
                save_state(s); run(tid)

    elif s["state"] == "MERGING":
        prompt = render("merge.md", ticket_id=tid, branch=s.get("branch", ""),
                        port=str(s.get("port", "")))
        run_claude(prompt, TIMEOUT_MERGE)
        cleanup(tid, s.get("port"))
        s["state"] = "DONE"; s["stop_reason"] = "Merged"; save_state(s)
        log(f"  DONE ✓")

    elif s["state"] in ("DONE", "ESCALATED", "NEEDS_CLARITY"):
        log(f"  Terminal: {s['state']}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python driver.py T-JXXX | --cleanup"); sys.exit(1)
    if sys.argv[1] == "--cleanup":
        for p in range(PORT_MIN, PORT_MAX + 1):
            subprocess.run(f"lsof -ti:{p} | xargs kill -9 2>/dev/null", shell=True, capture_output=True)
        log("All fix servers killed."); sys.exit(0)

    tid = sys.argv[1]
    log(f"=== Driver: {tid} ===")
    try:
        run(tid)
    except Exception as e:
        log(f"FATAL: {e}")
        s = load_state(tid); s["state"] = "ESCALATED"; s["error"] = str(e); save_state(s)
    log(f"=== Done: {tid} ===")
