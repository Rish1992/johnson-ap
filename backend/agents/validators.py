"""Post-step output validation for pipeline results."""

import json
from pathlib import Path

VALID_CLASSIFICATIONS = {"INVOICE", "NON_INVOICE", "AMBIGUOUS"}
VALID_CATEGORIES = {
    "SUBCONTRACTOR", "RUST_SUBCONTRACTOR", "DELIVERY_INSTALLATION",
    "FREIGHT_FINISHED_GOODS", "FREIGHT_SPARE_PARTS", "FREIGHT_ADDITIONAL_CHARGES",
}
VALID_ENTITIES = {"AU", "NZ"}
VALID_PO_TYPES = {"PO", "NON_PO"}


def validate_step_output(step_name: str, workspace: Path, category: str = None, db=None) -> tuple[bool, list[str]]:
    """Check results/{step}.json exists and matches expected schema.
    Returns (is_valid, list_of_errors).
    """
    result_file = workspace / "results" / f"{step_name}.json"
    if not result_file.exists():
        return False, [f"{step_name}.json not found in workspace"]

    try:
        result = json.loads(result_file.read_text())
    except json.JSONDecodeError as e:
        return False, [f"{step_name}.json is not valid JSON: {str(e)[:100]}"]

    validator = VALIDATORS.get(step_name)
    if not validator:
        return True, []

    errors = validator(result, category, db, workspace)
    return len(errors) == 0, errors


def _validate_classify(result: dict, category: str | None, db, workspace: Path = None) -> list[str]:
    errors = []
    c = result.get("classification")
    if c is None:
        errors.append("missing 'classification' field")
    elif c not in VALID_CLASSIFICATIONS:
        errors.append(f"classification '{c}' not in {VALID_CLASSIFICATIONS}")
    if not result.get("reasoning"):
        errors.append("missing or empty 'reasoning' field")
    return errors


def _validate_categorize(result: dict, category: str | None, db, workspace: Path = None) -> list[str]:
    errors = []
    cat = result.get("category")
    if cat is None:
        errors.append("missing 'category' field")
    elif cat not in VALID_CATEGORIES:
        errors.append(f"category '{cat}' not in {VALID_CATEGORIES}")
    ent = result.get("entity")
    if ent is None:
        errors.append("missing 'entity' field")
    elif ent not in VALID_ENTITIES:
        errors.append(f"entity '{ent}' not in {VALID_ENTITIES}")
    pt = result.get("poType")
    if pt is None:
        errors.append("missing 'poType' field")
    elif pt not in VALID_PO_TYPES:
        errors.append(f"poType '{pt}' not in {VALID_PO_TYPES}")
    ft = result.get("freightType")
    if ft is not None and ft not in ("SEA", "AIR"):
        errors.append(f"freightType must be null, 'SEA', or 'AIR', got '{ft}'")
    vm = result.get("vendorMatch")
    if not isinstance(vm, dict):
        errors.append("'vendorMatch' must be an object")
    elif "vendorId" not in vm or "vendorName" not in vm:
        errors.append("vendorMatch must have 'vendorId' and 'vendorName' keys")
    docs = result.get("documents")
    if not isinstance(docs, list):
        errors.append("'documents' must be a list")
    else:
        for i, d in enumerate(docs):
            if not isinstance(d, dict):
                errors.append(f"documents[{i}] must be an object")
                continue
            if "type" not in d:
                errors.append(f"documents[{i}] missing 'type'")
            if "status" not in d:
                errors.append(f"documents[{i}] missing 'status'")
            pages = d.get("pages")
            if pages is not None and not isinstance(pages, list):
                errors.append(f"documents[{i}].pages must be a list")
            elif isinstance(pages, list):
                for p in pages:
                    if not isinstance(p, int) or p < 1:
                        errors.append(f"documents[{i}].pages contains invalid page number: {p}")
    if not result.get("reasoning"):
        errors.append("missing or empty 'reasoning' field")
    return errors


def _validate_extract(result: dict, category: str | None, db, workspace: Path = None) -> list[str]:
    errors = []
    fields = result.get("fields")
    if not isinstance(fields, list):
        errors.append("'fields' must be a list")
        return errors

    if not isinstance(result.get("lineItems"), list):
        errors.append("'lineItems' must be a list")

    # Check each field has hard-required keys only
    for i, f in enumerate(fields):
        if not isinstance(f, dict):
            errors.append(f"fields[{i}] must be an object")
            continue
        for req in ("doc", "key"):
            if req not in f:
                errors.append(f"fields[{i}] missing '{req}'")

    # DB-driven field validation
    if category and db:
        from models import InvoiceCategoryConfig
        cfg = db.query(InvoiceCategoryConfig).filter(InvoiceCategoryConfig.name == category).first()
        if cfg:
            # Determine which doc types are actually present (from categorize documents)
            present_docs = {"Invoice"}  # Invoice is always expected
            if workspace:
                cat_file = workspace / "results" / "categorize.json"
                if cat_file.exists():
                    try:
                        cd = json.loads(cat_file.read_text())
                        for doc in cd.get("documents", []):
                            if doc.get("status") == "PRESENT":
                                present_docs.add(doc.get("type", ""))
                    except (json.JSONDecodeError, KeyError):
                        pass

            # Build expected (doc, key) pairs — only for present doc types
            expected = set()
            for f in (cfg.invoice_fields or []):
                expected.add(("Invoice", f["key"]))
            for doc_type, doc_fields in (cfg.supporting_fields or {}).items():
                if doc_type in present_docs:
                    for f in doc_fields:
                        expected.add((doc_type, f["key"]))

            # Check actual fields
            actual = {(f.get("doc"), f.get("key")) for f in fields if isinstance(f, dict)}
            missing = expected - actual
            if missing:
                missing_str = ", ".join(f"{d}.{k}" for d, k in sorted(missing))
                errors.append(f"Missing fields: {missing_str}")

            # Check doc values are valid
            valid_docs = {"Invoice"} | set((cfg.supporting_fields or {}).keys())
            for f in fields:
                if isinstance(f, dict) and f.get("doc") not in valid_docs:
                    errors.append(f"Invalid doc type: '{f.get('doc')}' (expected one of {valid_docs})")
    return errors


def _validate_validate(result: dict, category: str | None, db, workspace: Path = None) -> list[str]:
    errors = []
    results_list = result.get("results")
    if not isinstance(results_list, list):
        errors.append("'results' must be a list")
    else:
        for i, r in enumerate(results_list):
            if not isinstance(r, dict):
                errors.append(f"results[{i}] must be an object")
                continue
            if "ruleId" not in r:
                errors.append(f"results[{i}] missing 'ruleId'")
            if "status" not in r:
                errors.append(f"results[{i}] missing 'status'")
            if "message" not in r:
                errors.append(f"results[{i}] missing 'message'")
            # Validate fields array entries if present
            fields = r.get("fields")
            if fields is not None:
                if not isinstance(fields, list):
                    errors.append(f"results[{i}].fields must be a list")
                else:
                    for j, f in enumerate(fields):
                        if not isinstance(f, dict) or "doc" not in f or "key" not in f:
                            errors.append(f"results[{i}].fields[{j}] must have 'doc' and 'key'")
    return errors


VALIDATORS = {
    "classify": _validate_classify,
    "categorize": _validate_categorize,
    "extract": _validate_extract,
    "validate": _validate_validate,
}
