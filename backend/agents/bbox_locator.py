"""Locate bounding boxes for extracted invoice fields using pdftotext -bbox."""

import logging
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

from rapidfuzz import fuzz

log = logging.getLogger("agents.bbox_locator")


def _parse_bbox_xml(xml_text: str) -> list[dict]:
    """Parse pdftotext -bbox XML into word entries with normalized coords."""
    # Fix common XML issues (unescaped &)
    xml_text = re.sub(r"&(?!amp;|lt;|gt;|apos;|quot;|#)", "&amp;", xml_text)
    root = ET.fromstring(xml_text)
    ns = {"x": "http://www.w3.org/1999/xhtml"}
    words = []
    for pi, page in enumerate(root.findall(".//x:page", ns)):
        pw = float(page.get("width", 1))
        ph = float(page.get("height", 1))
        for w in page.findall("x:word", ns):
            x0 = float(w.get("xMin", 0)) / pw
            y0 = float(w.get("yMin", 0)) / ph
            x1 = float(w.get("xMax", 0)) / pw
            y1 = float(w.get("yMax", 0)) / ph
            words.append({
                "text": (w.text or "").strip(),
                "page": pi + 1,
                "x": round(x0, 5), "y": round(y0, 5),
                "width": round(x1 - x0, 5), "height": round(y1 - y0, 5),
                "y_raw": float(w.get("yMin", 0)),
            })
    return words


def _find_bbox(words: list[dict], value: str, threshold: int = 80) -> dict | None:
    """Find bbox for a value string among words. Returns best match or None."""
    if not value or len(str(value).strip()) < 2:
        return None
    value = str(value).strip()
    tokens = value.split()

    # Single word: direct fuzzy match
    if len(tokens) == 1:
        best, best_score = None, 0
        for w in words:
            # Fuzzy match
            score = fuzz.ratio(value.lower(), w["text"].lower())
            if score > best_score:
                best, best_score = w, score
            # Substring match for numbers (e.g., "$768.90" contains "768.90")
            wt = w["text"]
            if len(wt) >= 3 and (value in wt or (len(wt) > len(value) * 0.5 and wt in value)):
                if 100 > best_score:
                    best, best_score = w, 100
        if best and best_score >= threshold:
            return {"page": best["page"], "x": best["x"], "y": best["y"],
                    "width": best["width"], "height": best["height"]}
        return None

    # Multi-word: sliding window on same-line groups
    n = len(tokens)
    best, best_score = None, 0
    # Group words by (page, approximate y)
    for i in range(len(words) - n + 1):
        window = words[i:i + n]
        # All on same page and similar y (within 2pt)
        if any(w["page"] != window[0]["page"] for w in window):
            continue
        if any(abs(w["y_raw"] - window[0]["y_raw"]) > 3 for w in window):
            continue
        joined = " ".join(w["text"] for w in window)
        score = fuzz.ratio(value.lower(), joined.lower())
        if score > best_score:
            best, best_score = window, score

    if best and best_score >= (75 if len(tokens) > 1 else threshold):
        x0 = min(w["x"] for w in best)
        y0 = min(w["y"] for w in best)
        x1 = max(w["x"] + w["width"] for w in best)
        y1 = max(w["y"] + w["height"] for w in best)
        return {"page": best[0]["page"], "x": round(x0, 5), "y": round(y0, 5),
                "width": round(x1 - x0, 5), "height": round(y1 - y0, 5)}
    return None


def find_invoice_pdf(attachments_dir: Path) -> Path | None:
    """Find the invoice PDF in attachments dir. Prefers split fragments with _invoice in name."""
    pdf_files = list(attachments_dir.glob("*.pdf")) + list(attachments_dir.glob("*.PDF"))
    if not pdf_files:
        return None
    # Prefer files with _invoice in name (from doc_splitter)
    for f in pdf_files:
        if "_invoice" in f.stem.lower():
            return f
    # Fallback: first PDF (backwards compat with pre-split uploads)
    return pdf_files[0]


def locate_bboxes(pdf_path: str, extract_result: dict) -> dict:
    """Enrich confidenceScores with bbox locations from PDF text layer."""
    scores = extract_result.get("confidenceScores", {})
    if not scores:
        return scores

    try:
        proc = subprocess.run(
            ["pdftotext", "-bbox", pdf_path, "-"],
            capture_output=True, text=True, timeout=10,
        )
        if proc.returncode != 0:
            log.warning(f"pdftotext failed: {proc.stderr[:200]}")
            return scores
        words = _parse_bbox_xml(proc.stdout)
    except Exception as e:
        log.warning(f"bbox parse failed: {e}")
        return scores

    header = extract_result.get("headerData", {})
    for field_name, entry in scores.items():
        if not isinstance(entry, dict):
            continue
        value = entry.get("extractedValue") or str(header.get(field_name, ""))
        bbox = _find_bbox(words, value)
        if bbox:
            entry["bbox"] = bbox

    return scores
