from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import json, base64
from pathlib import Path

app = FastAPI(title="Johnson AP Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://chat.dev.fiscalix.com", "http://localhost:5180"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FEEDBACK_DIR = Path(__file__).parent / "feedback"
SCREENSHOTS_DIR = FEEDBACK_DIR / "screenshots"
REPORTS_FILE = FEEDBACK_DIR / "reports.json"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
if not REPORTS_FILE.exists():
    REPORTS_FILE.write_text("[]")


@app.post("/api/feedback")
async def submit_feedback(request: Request):
    body = await request.json()
    report = body.get("report", {})
    screenshot = body.get("screenshot")
    if screenshot and report.get("id"):
        b64 = screenshot.split(",", 1)[-1] if "," in screenshot else screenshot
        (SCREENSHOTS_DIR / f"{report['id']}.png").write_bytes(base64.b64decode(b64))
        report["screenshotPath"] = f"feedback/screenshots/{report['id']}.png"
    reports = json.loads(REPORTS_FILE.read_text())
    reports.append(report)
    REPORTS_FILE.write_text(json.dumps(reports, indent=2))
    return {"success": True, "id": report.get("id")}


@app.get("/api/feedback")
async def list_feedback():
    return json.loads(REPORTS_FILE.read_text())


@app.get("/health")
async def health():
    return {"status": "ok", "service": "johnson-ap-backend"}
