from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json, base64, sqlite3, time, shutil, logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("johnson-ap")

# ---------------------------------------------------------------------------
# Startup / Shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables, seed data, kill orphaned claude processes."""
    from db import create_tables
    from seed import seed_all
    from db import SessionLocal
    from agents.runner import kill_orphaned_claude_processes

    log.info("Creating DB tables...")
    create_tables()

    log.info("Seeding data (if empty)...")
    db = SessionLocal()
    try:
        seed_all(db)
    finally:
        db.close()

    log.info("Killing orphaned claude processes...")
    kill_orphaned_claude_processes()

    # Ensure upload/workspace dirs exist
    Path(__file__).parent.joinpath("workspaces").mkdir(exist_ok=True)
    Path(__file__).parent.joinpath("uploads").mkdir(exist_ok=True)

    log.info("Johnson AP backend ready.")
    yield


app = FastAPI(title="Johnson AP Backend", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://chat.dev.fiscalix.com", "http://localhost:5180", "http://localhost:5191", "http://localhost:5190", "https://johnson.dev.fiscalix.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add CORS headers to ALL responses (including static files like PDFs)
from starlette.middleware.base import BaseHTTPMiddleware
class CORSStaticMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        origin = request.headers.get("origin", "")
        if origin in ["https://chat.dev.fiscalix.com", "http://localhost:5180", "http://localhost:5191", "https://johnson.dev.fiscalix.com"]:
            response.headers["Access-Control-Allow-Origin"] = origin
        return response

app.add_middleware(CORSStaticMiddleware)

# ---------------------------------------------------------------------------
# Mount routers
# ---------------------------------------------------------------------------
from auth import router as auth_router
from routers.admin import router as admin_router
from routers.masters import router as masters_router
from routers.pipeline import router as pipeline_router
from routers.cases import router as cases_router

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(masters_router)
app.include_router(pipeline_router)
app.include_router(cases_router)

# Serve uploaded files
uploads_dir = Path(__file__).parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Serve test data files
test_data_dir = Path(__file__).parent / "test-data"
if test_data_dir.exists():
    app.mount("/test-data", StaticFiles(directory=str(test_data_dir)), name="test-data")

@app.get("/api/test-cases")
async def list_test_cases():
    """Return available pre-configured test cases for the playground."""
    return [
        {
            "id": "subcontractor-revofit",
            "name": "Subcontractor — RevoFit Warranty Repair",
            "fromAddress": "accounts@revofit.com.au",
            "fromName": "RevoFit Accounts",
            "subject": "Invoice INVJ2508217 - Service Call JAU250801221 Revo Claremont",
            "body": "Hi,\n\nPlease find attached invoice for service call at Revo Fitness Claremont.\n\nJob reference: JAU250801221\nModel: G3 Matrix Aura Adjustable Pulley\nTechnicians: Jordan, Rob, Kate\nService date: 14/08/2025\n\nKind regards,\nRevoFit Accounts",
            "files": [
                {"name": "subcontractor_invoice.pdf", "url": "/test-data/subcontractor_invoice.pdf"},
                {"name": "subcontractor_worksheet.pdf", "url": "/test-data/subcontractor_worksheet.pdf"},
            ],
        },
    ]

# ---------------------------------------------------------------------------
# Original feedback system (preserved)
# ---------------------------------------------------------------------------
FEEDBACK_DIR = Path(__file__).parent / "feedback"
SCREENSHOTS_DIR = FEEDBACK_DIR / "screenshots"
REPORTS_FILE = FEEDBACK_DIR / "reports.json"
TTP_DB = Path("/home/ubuntu/dev/aistra-assistant/projects/projects.db")
SERVED_SCREENSHOTS = Path("/home/ubuntu/dev/aistra-assistant/downloads/feedback")
SCREENSHOT_URL_BASE = "https://chat.dev.fiscalix.com/feedback-screenshots"
PROJECT_ID = "johnson-ap"
PHASE_ID = "phase-j02"  # Development phase

SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
SERVED_SCREENSHOTS.mkdir(parents=True, exist_ok=True)
if not REPORTS_FILE.exists():
    REPORTS_FILE.write_text("[]")


def _next_task_id():
    """Get next T-JXXX ID from the database."""
    db = sqlite3.connect(str(TTP_DB))
    rows = db.execute(
        "SELECT id FROM tasks WHERE project_id = ? AND id LIKE 'T-J%' ORDER BY id DESC LIMIT 1",
        (PROJECT_ID,)).fetchall()
    db.close()
    if not rows:
        return "T-J001"
    last_num = int(rows[0][0].replace("T-J", ""))
    return f"T-J{last_num + 1:03d}"


def _create_ticket(report: dict, screenshot_url: str | None) -> str | None:
    """Create a talk-to-project task from a feedback report. Returns task ID or None."""
    try:
        db = sqlite3.connect(str(TTP_DB))
        task_id = _next_task_id()
        severity = report.get("severity", "high").upper()
        comment = report.get("comment", "No description")
        title = f"[{severity}] {comment[:70]}"
        rtype = report.get("type", "bug")
        task_type = "bug" if rtype == "bug" else "task"

        # Build description
        lines = [f"**Reporter:** {report.get('user', 'Unknown')} ({report.get('userRole', '')})"]
        lines.append(f"**Page:** {report.get('page', 'Unknown')}")
        if report.get("caseId"):
            lines.append(f"**Case:** {report['caseId']} ({report.get('caseStatus', '')}, {report.get('caseVendor', '')}, {report.get('caseCategory', '')})")
        lines.append(f"**Element:** `{report.get('element', 'Unknown')}`")
        lines.append(f"**Viewport:** {report.get('viewport', '')} | **Browser:** {report.get('userAgent', '')[:60]}")
        lines.append("")
        lines.append(comment)
        if report.get("expectedBehavior"):
            lines.append(f"\n**Expected:** {report['expectedBehavior']}")
        if screenshot_url:
            lines.append(f"\n**Screenshot:** {screenshot_url}")
        if report.get("consoleLogs"):
            lines.append(f"\n**Console Logs:**\n```\n" + "\n".join(report["consoleLogs"][-5:]) + "\n```")
        if report.get("networkLogs"):
            lines.append(f"\n**Network Logs:**\n```\n" + "\n".join(report["networkLogs"][-5:]) + "\n```")

        description = "\n".join(lines)

        db.execute(
            """INSERT INTO tasks (id, project_id, phase_id, title, description, status, type, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'todo', ?, datetime('now'), datetime('now'))""",
            (task_id, PROJECT_ID, PHASE_ID, title, description, task_type))
        db.commit()
        db.close()
        return task_id
    except Exception as e:
        print(f"[WARN] Failed to create ticket: {e}")
        return None


@app.post("/api/feedback")
async def submit_feedback(request: Request):
    body = await request.json()
    report = body.get("report", {})
    screenshot = body.get("screenshot")
    screenshot_url = None

    # Save screenshot
    if screenshot and report.get("id"):
        b64 = screenshot.split(",", 1)[-1] if "," in screenshot else screenshot
        local_path = SCREENSHOTS_DIR / f"{report['id']}.png"
        local_path.write_bytes(base64.b64decode(b64))
        report["screenshotPath"] = f"feedback/screenshots/{report['id']}.png"
        # Copy to served location
        served_path = SERVED_SCREENSHOTS / f"{report['id']}.png"
        shutil.copy2(str(local_path), str(served_path))
        screenshot_url = f"{SCREENSHOT_URL_BASE}/{report['id']}.png"

    # Save to local JSON
    reports = json.loads(REPORTS_FILE.read_text())
    reports.append(report)
    REPORTS_FILE.write_text(json.dumps(reports, indent=2))

    # Forward to talk-to-project
    task_id = _create_ticket(report, screenshot_url)
    if task_id:
        report["taskId"] = task_id

    return {"success": True, "id": report.get("id"), "taskId": task_id}


@app.get("/api/feedback")
async def list_feedback():
    return json.loads(REPORTS_FILE.read_text())


@app.get("/health")
async def health():
    return {"status": "ok", "service": "johnson-ap-backend", "version": "0.2.0"}
