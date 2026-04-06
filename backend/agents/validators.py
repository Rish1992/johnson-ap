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

    errors = validator(result, category, db)
    return len(errors) == 0, errors


def _validate_classify(result: dict, category: str | None, db) -> list[str]:
    errors = []
    c = result.get("classification")
    if c is None:
        errors.append("missing 'classification' field")
    elif c not in VALID_CLASSIFICATIONS:
        errors.append(f"classification '{c}' not in {VALID_CLASSIFICATIONS}")
    conf = result.get("confidence")
    if conf is None:
        errors.append("missing 'confidence' field")
    elif not isinstance(conf, (int, float)) or not (0 <= conf <= 1):
        errors.append(f"confidence must be a number 0-1, got {conf}")
    return errors


def _validate_categorize(result: dict, category: str | None, db) -> list[str]:
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
    if result.get("confidence") is None:
        errors.append("missing 'confidence' field")
    return errors


def _validate_verify_docs(result: dict, category: str | None, db) -> list[str]:
    errors = []
    if not isinstance(result.get("verified"), bool):
        errors.append("'verified' must be a boolean")
    details = result.get("details")
    if not isinstance(details, list):
        errors.append("'details' must be a list")
    else:
        for i, d in enumerate(details):
            if not isinstance(d, dict):
                errors.append(f"details[{i}] must be an object")
                continue
            for key in ("documentType", "fileName", "status"):
                if key not in d:
                    errors.append(f"details[{i}] missing '{key}'")
    return errors


def _validate_extract(result: dict, category: str | None, db) -> list[str]:
    errors = []
    if not isinstance(result.get("headerData"), dict):
        errors.append("'headerData' must be a dict")
    if "supportingData" not in result:
        errors.append("missing 'supportingData' field")
    if not isinstance(result.get("lineItems"), list):
        errors.append("'lineItems' must be a list")
    if not isinstance(result.get("confidenceScores"), dict):
        errors.append("'confidenceScores' must be a dict")

    # DB-driven field validation
    if category and db:
        from models import InvoiceCategoryConfig
        cfg = db.query(InvoiceCategoryConfig).filter(InvoiceCategoryConfig.name == category).first()
        if cfg:
            # Check invoice fields
            expected_invoice = {f["key"] for f in (cfg.invoice_fields or [])}
            actual_invoice = set(result.get("headerData", {}).keys()) if isinstance(result.get("headerData"), dict) else set()
            missing_inv = expected_invoice - actual_invoice
            if missing_inv:
                errors.append(f"headerData missing keys: {', '.join(sorted(missing_inv))}")

            # Check supporting fields (flattened across doc types)
            expected_supporting = set()
            for fields in (cfg.supporting_fields or {}).values():
                for f in fields:
                    expected_supporting.add(f["key"])
            if expected_supporting:
                actual_supporting = set()
                sd = result.get("supportingData")
                if isinstance(sd, dict):
                    for doc_fields in sd.values():
                        if isinstance(doc_fields, dict):
                            actual_supporting.update(doc_fields.keys())
                missing_sup = expected_supporting - actual_supporting
                if missing_sup:
                    errors.append(f"supportingData missing keys: {', '.join(sorted(missing_sup))}")
    return errors


def _validate_validate(result: dict, category: str | None, db) -> list[str]:
    errors = []
    results_list = result.get("results")
    if not isinstance(results_list, list):
        errors.append("'results' must be a list")
    else:
        for i, r in enumerate(results_list):
            if not isinstance(r, dict):
                errors.append(f"results[{i}] must be an object")
                continue
            if "ruleId" not in r and "ruleName" not in r:
                errors.append(f"results[{i}] missing 'ruleId' or 'ruleName'")
            if "status" not in r:
                errors.append(f"results[{i}] missing 'status'")
    return errors


VALIDATORS = {
    "classify": _validate_classify,
    "categorize": _validate_categorize,
    "verify_docs": _validate_verify_docs,
    "extract": _validate_extract,
    "validate": _validate_validate,
}
