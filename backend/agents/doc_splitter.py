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
    success, result, error, _ = await run_claude_step(
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


def generate_document_text(pdf_path: str, workspace: Path) -> tuple[bool, int]:
    """Extract text per page from PDF. OCR scanned pages. Write DOCUMENT_TEXT.md.
    Returns (is_large_doc, page_count).
    """
    page_texts = _extract_page_texts(pdf_path)
    num_pages = len(page_texts)
    is_large = num_pages > 10

    if not is_large:
        return False, num_pages

    md_lines = []
    for i, text in enumerate(page_texts, 1):
        md_lines.append(f"# Page {i}")
        if len(text.strip()) < 50:
            text = _ocr_page(pdf_path, i)
        md_lines.append(text if text.strip() else "(no text extracted)")

    (workspace / "DOCUMENT_TEXT.md").write_text("\n\n".join(md_lines))
    return True, num_pages


def _ocr_page(pdf_path: str, page_num: int) -> str:
    """Render a single PDF page to image and OCR it. Tries AWS Textract first, falls back to Tesseract."""
    try:
        from pdf2image import convert_from_path
        images = convert_from_path(pdf_path, first_page=page_num, last_page=page_num, dpi=200)
        if not images:
            return ""
        import io
        buf = io.BytesIO()
        images[0].save(buf, format="PNG")
        image_bytes = buf.getvalue()

        # Try AWS Textract first (higher quality, handles complex layouts)
        text = _ocr_textract(image_bytes, page_num)
        if text:
            return text

        # Fallback to Tesseract
        log.info(f"Textract unavailable for page {page_num}, falling back to Tesseract")
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".png", delete=True) as tmp:
            tmp.write(image_bytes)
            tmp.flush()
            proc = subprocess.run(
                ["tesseract", tmp.name, "stdout"], capture_output=True, text=True, timeout=60
            )
            return proc.stdout if proc.returncode == 0 else ""
    except Exception as e:
        log.warning(f"OCR failed for page {page_num}: {e}")
        return ""


def _ocr_textract(image_bytes: bytes, page_num: int) -> str:
    """OCR a page image using AWS Textract. Returns extracted text or empty string on failure."""
    try:
        import boto3
        import os
        key = os.environ.get("AWS_ACCESS_KEY_ID_FOR_AWS_TEXT_RACT")
        secret = os.environ.get("AWS_SECRET_ACCESS_KEY_FOR_AWS_TEXT_RACT")
        if not key or not secret:
            return ""
        client = boto3.client("textract",
            aws_access_key_id=key, aws_secret_access_key=secret,
            region_name="us-east-1",
        )
        response = client.detect_document_text(Document={"Bytes": image_bytes})
        lines = [b["Text"] for b in response.get("Blocks", []) if b["BlockType"] == "LINE"]
        text = "\n".join(lines)
        log.info(f"Textract OCR page {page_num}: {len(lines)} lines extracted")
        return text
    except Exception as e:
        log.warning(f"Textract failed for page {page_num}: {e}")
        return ""


def extract_first_n_pages(pdf_path: str, workspace: Path, n: int = 2) -> str:
    """Extract first N pages from PDF as a separate file for visual context."""
    from pypdf import PdfReader, PdfWriter
    reader = PdfReader(pdf_path)
    writer = PdfWriter()
    for i in range(min(n, len(reader.pages))):
        writer.add_page(reader.pages[i])
    out_name = f"preview_{Path(pdf_path).stem}.pdf"
    out_path = workspace / "attachments" / out_name
    with open(out_path, "wb") as f:
        writer.write(f)
    return out_name


def split_pdf_by_pages(pdf_path: str, documents: list[dict], workspace: Path) -> list[dict]:
    """Split PDF into fragments based on categorize document page mapping.
    documents: list of {type, pages, status} from categorize.json
    Returns list of {file_path, document_type, pages, fileName} for created fragments.
    """
    from pypdf import PdfReader, PdfWriter
    reader = PdfReader(pdf_path)
    attachments_dir = workspace / "attachments"
    stem = Path(pdf_path).stem
    results = []

    for doc in documents:
        if doc.get("status") != "PRESENT":
            continue
        pages = doc.get("pages", [])
        if not pages:
            continue
        doc_type = doc.get("type", "Unknown")
        if doc_type == "Other":
            continue

        writer = PdfWriter()
        for p in sorted(pages):
            if 1 <= p <= len(reader.pages):
                writer.add_page(reader.pages[p - 1])

        safe_type = doc_type.replace(" ", "_").replace("/", "_")
        out_name = f"{stem}_{safe_type}.pdf"
        out_path = attachments_dir / out_name
        with open(out_path, "wb") as f:
            writer.write(f)

        results.append({
            "file_path": str(out_path),
            "document_type": doc_type,
            "pages": pages,
            "fileName": out_name,
        })

    return results


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
