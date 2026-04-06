# Extract Output Schema v2 -- Design Document

**Date:** 2026-04-06
**Author:** Samrat Sah
**Status:** Draft -- pending review

---

## 1. Final Schema

### 1.1 LLM Output (what the extract agent returns)

```json
{
  "fields": [
    {
      "doc": "Invoice",
      "key": "vendorName",
      "value": "Blue SL Pty Ltd",
      "page": 1
    },
    {
      "doc": "Contractor Worksheet",
      "key": "caseNumber",
      "value": "JAU260100588",
      "page": 3
    }
  ],
  "lineItems": [
    {
      "line": 1,
      "description": "Johnson Call Out 15 Mins Labour INC",
      "quantity": 1,
      "unitPrice": 109.09,
      "total": 109.09,
      "tax": 10.91
    }
  ]
}
```

That's it. No `confidenceScores`, no `level`, no `extractedValue` duplication, no `headerData`/`supportingData` nesting.

### 1.2 Post-Processing Enrichment (what pipeline.py adds)

After the LLM returns, pipeline code enriches each field entry:

```json
{
  "doc": "Invoice",
  "key": "vendorName",
  "value": "Blue SL Pty Ltd",
  "page": 1,
  "file": "invoice_16156T.pdf",
  "bbox": {"x": 0.12, "y": 0.08, "width": 0.25, "height": 0.02},
  "status": "ok",
  "flags": []
}
```

Fields added by post-processing:
- `file` -- resolved from `page` number + verify_docs document map
- `bbox` -- from pdftotext bbox locator
- `status` -- `"ok"` | `"missing"` | `"mismatch"` | `"flagged"` (set by validator)
- `flags` -- array of validation issue strings (set by validator)

### 1.3 Subcontractor Example (complete)

```json
{
  "fields": [
    {"doc": "Invoice", "key": "vendorName", "value": "Blue SL Pty Ltd", "page": 1},
    {"doc": "Invoice", "key": "vendorABN", "value": "72 424 989 387", "page": 1},
    {"doc": "Invoice", "key": "invoiceNumber", "value": "16156T", "page": 1},
    {"doc": "Invoice", "key": "invoiceDate", "value": "2026-03-17", "page": 1},
    {"doc": "Invoice", "key": "grandTotal", "value": 120.00, "page": 1},
    {"doc": "Invoice", "key": "taxAmount", "value": 10.91, "page": 1},
    {"doc": "Invoice", "key": "subTotal", "value": 109.09, "page": 1},
    {"doc": "Invoice", "key": "attachmentReference", "value": "JAU260100588", "page": 1},
    {"doc": "Invoice", "key": "bankDetails", "value": "BSB 105 025, Acc 052 939 740", "page": 1},
    {"doc": "Contractor Worksheet", "key": "caseNumber", "value": "JAU260100588", "page": 3},
    {"doc": "Contractor Worksheet", "key": "branch", "value": "Home", "page": 3},
    {"doc": "Contractor Worksheet", "key": "jobCategory", "value": "Warranty- Repair", "page": 3},
    {"doc": "Contractor Worksheet", "key": "customerSignature", "value": null, "page": 3},
    {"doc": "Work Order", "key": "workOrderNumber", "value": "JAU260100588", "page": 5},
    {"doc": "Work Order", "key": "warrantyStatus", "value": "Warranty- Repair", "page": 5}
  ],
  "lineItems": [
    {"line": 1, "description": "Johnson Call Out 15 Mins Labour INC", "quantity": 1, "unitPrice": 109.09, "total": 109.09, "tax": 10.91}
  ]
}
```

### 1.4 Freight Example (Sea)

```json
{
  "fields": [
    {"doc": "Invoice", "key": "vendorName", "value": "Mainfreight Air & Ocean Pty Ltd", "page": 1},
    {"doc": "Invoice", "key": "invoiceNumber", "value": "INV-90821", "page": 1},
    {"doc": "Invoice", "key": "consignor", "value": "Johnson Health Tech Taiwan", "page": 1},
    {"doc": "Invoice", "key": "consignee", "value": "Johnson Health Tech Australia Pty Ltd", "page": 1},
    {"doc": "Invoice", "key": "containerNumber", "value": "MSCU1234567", "page": 1},
    {"doc": "Invoice", "key": "containerType", "value": "40 High Cube", "page": 1},
    {"doc": "Invoice", "key": "goodsDescription", "value": "Treadmills", "page": 2},
    {"doc": "Invoice", "key": "origin", "value": "Taiwan", "page": 1},
    {"doc": "Invoice", "key": "destination", "value": "Melbourne", "page": 1},
    {"doc": "Invoice", "key": "grandTotal", "value": 4850.00, "page": 2},
    {"doc": "Invoice", "key": "currency", "value": "USD", "page": 2},
    {"doc": "Commercial Invoice", "key": "commercialInvoiceNumber", "value": "CI-2026-0451", "page": 4},
    {"doc": "Commercial Invoice", "key": "totalValue", "value": 125000.00, "page": 4}
  ],
  "lineItems": [
    {"line": 1, "description": "Ocean Freight", "quantity": 1, "unitPrice": 3200.00, "total": 3200.00, "tax": 0},
    {"line": 2, "description": "Terminal Handling", "quantity": 1, "unitPrice": 850.00, "total": 850.00, "tax": 0},
    {"line": 3, "description": "Customs Clearance", "quantity": 1, "unitPrice": 450.00, "total": 450.00, "tax": 45.00}
  ]
}
```

---

## 2. Field Identity -- Composite Key

A field is uniquely identified by the tuple: **(doc, key)**.

- `doc` MUST be one of the document type names from `InvoiceCategoryConfig`: `"Invoice"` for invoice_fields, or one of the `supportingFields` keys (e.g., `"Contractor Worksheet"`, `"Work Order"`, `"Installation Worksheet"`, `"Commercial Invoice"`).
- `key` MUST be one of the field keys defined in the config for that doc type.

The validator rejects any field where `(doc, key)` doesn't exist in the category config.

### Why not a flat key like `"invoice.vendorName"`?

Because `doc` is data, not namespace. The same physical key name `customerAddress` can appear under different doc types with different values (invoice Bill To address vs worksheet service location). Keeping `doc` as a separate field makes filtering trivial in the frontend and validator.

---

## 3. Edge Case Resolutions

### EC1: Multiple documents of the same type

Two contractor worksheets for two different jobs in one email? Each becomes a separate case after doc_splitter. The extract agent processes ONE case at a time -- each case has at most one document per type. If doc_splitter fails to split them, the LLM extracts from the first/primary one and flags uncertainty via a low page count (the validator will catch it if cross-ref fields don't match).

**No schema change needed.** The pipeline's doc_splitter is responsible for producing one-case-per-invoice.

### EC2: Multi-page documents

A single invoice spans pages 1-3. The LLM reports the page where it found each specific value:

```json
{"doc": "Invoice", "key": "vendorName", "value": "...", "page": 1}
{"doc": "Invoice", "key": "grandTotal", "value": 120.00, "page": 3}
```

`page` is always the page number within the file the LLM is reading. If the file has 5 pages, page ranges 1-5.

### EC3: Merged PDFs

Before doc_splitter: one PDF, pages 1-5 (invoice pp1-2, worksheet pp3-5).
After doc_splitter: two files -- `invoice_16156T.pdf` (pp1-2) and `worksheet_JAU260100588.pdf` (pp1-3, renumbered).

The extract agent runs AFTER doc_splitter. It reads the split files. So `page` refers to the page within the split file. Post-processing maps `(doc, page)` to the correct split file using the verify_docs output which maps doc types to filenames.

**Document-to-file mapping** is stored in `verify_docs.json`:
```json
{
  "details": [
    {"documentType": "Invoice", "fileName": "invoice_16156T.pdf", "status": "present"},
    {"documentType": "Contractor Worksheet", "fileName": "worksheet_JAU260100588.pdf", "status": "present"}
  ]
}
```

Post-processing resolves: `field.doc` -> look up in verify_docs -> get `fileName` -> set `field.file`.

### EC4: Cross-document matching (fields that span documents)

Matching rules are NOT in the extract schema. They live in `InvoiceCategoryConfig.validationRules` and are executed by the validate step.

The validate step receives the flat field list and applies rules like:
```
CROSS_REF: fields.find(doc="Invoice", key="attachmentReference").value 
           == fields.find(doc="Contractor Worksheet", key="caseNumber").value
```

The validator writes match results as validation rule outcomes, not as field properties. This keeps extraction clean and validation separate.

### EC5: Missing documents

Category config expects "Work Order" but it's absent. The verify_docs step already flags this:
```json
{"documentType": "Work Order", "fileName": null, "status": "missing"}
```

In the extract output, there will simply be NO fields with `doc: "Work Order"`. The validator detects missing required supporting docs by checking: for each doc type in `supportingFields`, are there any fields with that `doc` value? If zero, flag the entire doc as missing.

**No sentinel values.** Missing docs produce zero fields, not null-valued fields.

### EC6: LLM outputs wrong doc type

The validator checks every `field.doc` value against the config's allowed doc types for this category. If `doc` is not in `["Invoice"] + list(supportingFields.keys())`, the field is rejected.

Additionally, the validator cross-checks `field.doc` against `verify_docs.json`. If verify_docs says "Contractor Worksheet" is present but the LLM emits fields under "Installation Worksheet" (which isn't in this category), those fields are dropped with a warning.

### EC7: Same field name, different doc types

This works naturally with the `(doc, key)` composite key:

```json
{"doc": "Invoice", "key": "customerAddress", "value": "132 Vision St, Dandenong", "page": 1}
{"doc": "Contractor Worksheet", "key": "customerAddress", "value": "8A Wandilla Dr, Rostrevor", "page": 3}
```

Both are valid. Different `doc` values make them distinct fields. The frontend renders them under their respective document tabs.

### EC8: Freight 4-way matching (Invoice + Commercial Invoice + Rate Card)

Rate card data is NOT a document in the email -- it's master data in the database. The schema only covers extracted fields from attached documents.

Rate card matching happens in the validate step:
1. Extract step outputs freight line items and field values
2. Validate step loads `FreightRateCard` from the database
3. Validate step compares extracted amounts against rate card
4. Results are written as validation rule outcomes (PASS/FAIL with details)

The validate step already has access to master data via `write_master_data()`. No schema change needed -- the boundary is: **extract = what's on the documents, validate = comparison against master data**.

### EC9: Field not found vs field intentionally empty

- **Not found** (no PO number field on the document): the LLM omits the field entirely. The validator checks required fields against the config -- if a required field is absent from the output, status = `"missing"`.
- **Found but empty** (PO field exists but is blank): `"value": null` with a valid page number.

```json
{"doc": "Invoice", "key": "purchaseOrderNumber", "value": null, "page": 1}
```

`value: null` + `page` present = "I found where this should be, but it's blank."
Field absent entirely = "This field doesn't appear on the document."

The validator treats both as flags but with different messages: "PO number blank on invoice (page 1)" vs "PO number not found on invoice."

### EC10: Multiple invoices in one attachment (pre-split processing)

This doesn't happen. The extract step runs AFTER doc_splitter. Each case is one invoice. If doc_splitter produces two cases from one PDF, each case gets its own workspace with its own split files.

If the LLM is processing pre-split (shouldn't happen, but defensive): the `page` number refers to the original file's pages. Post-processing would fail to resolve the file since verify_docs hasn't run. This is caught by the validator as a pipeline ordering error, not a schema issue.

### EC11: Meaningful confidence

**LLM self-reported confidence is dropped entirely.** The LLM outputs no confidence scores.

Instead, confidence is computed by post-processing:

| Signal | Score contribution |
|--------|-------------------|
| Value present and non-null | +30 |
| Page number present | +10 |
| Bbox found by pdftotext | +20 |
| Value matches regex for type (date looks like date, number is numeric) | +10 |
| Cross-doc match passes (e.g., attachmentReference == caseNumber) | +15 |
| Vendor master match | +15 |

Each field gets a computed score 0-100. The `overall_confidence` is the mean across all required fields.

This is deterministic, auditable, and actually varies by field quality -- unlike LLM self-reported 0.95 for everything.

### EC12: Schema evolution

The schema is driven entirely by `InvoiceCategoryConfig`. Adding a new category or doc type:

1. Add a new `InvoiceCategoryConfig` row with `invoice_fields` and `supporting_fields`
2. The extract prompt reads FIELD_LIST.md which is auto-generated from the config
3. The validator checks against the config
4. No code changes needed for new categories

New field types (signatures, checkboxes, images):
- The `type` field in the config already supports `"signature"`, `"date"`, `"currency"`, etc.
- The `value` in the output is always a string or number or null. For signatures: `"present"` | `"not signed"` | `null`.
- Image fields (future): `value` could be a relative file path to an extracted crop. But that's a future concern -- the schema supports it via string values.

---

## 4. Matching Rules

Matching rules stay in `InvoiceCategoryConfig.validationRules`. They are NOT part of the extract schema.

The validate step uses the flat field list to execute rules:

```python
def execute_rule(rule, fields):
    """Example: CROSS_REF rule."""
    inv_ref = next((f["value"] for f in fields if f["doc"] == "Invoice" and f["key"] == "attachmentReference"), None)
    ws_ref = next((f["value"] for f in fields if f["doc"] == "Contractor Worksheet" and f["key"] == "caseNumber"), None)
    if inv_ref and ws_ref:
        return "PASS" if inv_ref == ws_ref else "FAIL"
    return "MISSING"  # can't evaluate -- data not available
```

The flat field list makes matching rules trivial -- just filter by `(doc, key)` and compare values.

### Matching rule types by category:

| Category | Rule | Fields Compared |
|----------|------|-----------------|
| Subcontractor | Cross-ref | Invoice.attachmentReference == Worksheet.caseNumber |
| Subcontractor | Amount match | Invoice.grandTotal == WorkOrder.workOrderDetails (parsed) |
| D&I | Cross-ref | Invoice.attachmentReference == InstallationWorksheet.caseNumber |
| D&I | Quote match | Invoice.subTotal == InstallationWorksheet.quoteAmount |
| D&I | Date check | Invoice.invoiceDate <= Worksheet.dateJobCompleted + 7 days |
| Freight | Rate card | Invoice line items vs FreightRateCard (DB lookup, not extracted) |
| Freight | Bank details | Invoice.bankDetails vs VendorMaster.bankDetails (DB lookup) |
| All | Math check | Invoice.grandTotal == Invoice.subTotal + Invoice.taxAmount |
| All | Vendor match | Invoice.vendorName ~= VendorMaster.name |
| All | Entity/currency | Invoice.currency matches entity (AUD for AU, NZD for NZ) |

---

## 5. Confidence Strategy

**Who computes it:** Post-processing in pipeline.py, NOT the LLM.

**When:** After extract, before validate. A new function `compute_field_confidence(fields, workspace)` runs between the extract and validate steps.

**Algorithm:**

```python
def compute_field_confidence(field, words_by_file, config_field):
    score = 0
    # Present
    if field["value"] is not None:
        score += 40
    # Page located
    if field.get("page"):
        score += 10
    # Bbox found
    if field.get("bbox"):
        score += 20
    # Type-valid (date parses, number is numeric, etc.)
    if _type_check(field["value"], config_field["type"]):
        score += 15
    # Required and present
    if config_field["required"] and field["value"] is not None:
        score += 15
    return min(score, 100)
```

Cross-doc matching bonuses are added by the validate step after it runs matching rules.

---

## 6. What LLM Outputs vs What Post-Processing Adds

| Property | LLM outputs | Post-processing adds |
|----------|-------------|---------------------|
| `doc` | YES | -- |
| `key` | YES | -- |
| `value` | YES | -- |
| `page` | YES | -- |
| `file` | NO | Resolved from verify_docs doc-type-to-filename map |
| `bbox` | NO | pdftotext bbox locator |
| `status` | NO | Validator sets ok/missing/mismatch/flagged |
| `flags` | NO | Validator populates with issue descriptions |
| `confidence` | NO | Computed from signals (presence, bbox, type match) |
| `lineItems[].line` | YES | -- |
| `lineItems[].description` | YES | -- |
| `lineItems[].quantity` | YES | -- |
| `lineItems[].unitPrice` | YES | -- |
| `lineItems[].total` | YES | -- |
| `lineItems[].tax` | YES | -- |

**Token savings:** The current CASE-0034 extract.json is 265 lines. The v2 equivalent would be ~50 lines. The `confidenceScores` block (which is 61% of tokens) is eliminated entirely from LLM output.

---

## 7. Impact on FIELD_LIST.md

The prompt instruction in FIELD_LIST.md changes from "populate headerData/supportingData" to "return a flat fields array."

Current FIELD_LIST.md structure (auto-generated by `prepare_step`):
```
## Invoice Fields
| # | Key | Label | Type | Required | ...

## Supporting: Contractor Worksheet
| # | Key | Label | Type | Required | ...
```

New FIELD_LIST.md adds an instruction header:

```markdown
# Field Definitions for Extraction

Return a flat `fields` array. For each field below, output:
  {"doc": "<Document Type>", "key": "<Key>", "value": <extracted value or null>, "page": <page number>}

Document type for Invoice Fields = "Invoice"
Document type for supporting fields = the section header below (e.g., "Contractor Worksheet")

## Invoice Fields
| # | Key | Label | Type | Required | Validation | Source Hint |
...

## Supporting: Contractor Worksheet
| # | Key | Label | Type | Required | Validation | Source Hint |
...
```

The LLM reads this and knows exactly what `doc` values to use and what `key` values are valid.

---

## 8. Migration Plan

### Phase A: Schema change (backend only, no frontend)

**8a. Update OUTPUT_SCHEMA.json in seed.py:**
Replace the extract `output_schema` with:
```json
{
  "type": "object",
  "properties": {
    "fields": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "doc": {"type": "string"},
          "key": {"type": "string"},
          "value": {},
          "page": {"type": "integer"}
        },
        "required": ["doc", "key"]
      }
    },
    "lineItems": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "line": {"type": "integer"},
          "description": {"type": "string"},
          "quantity": {"type": "number"},
          "unitPrice": {"type": "number"},
          "total": {"type": "number"},
          "tax": {"type": "number"}
        }
      }
    }
  },
  "required": ["fields", "lineItems"]
}
```

**8b. Update extract prompt** in seed.py to reference flat field list format.

**8c. Update `prepare_step`** in runner.py to add instruction header to FIELD_LIST.md.

**8d. Update `_validate_extract`** in validators.py:
- Check `fields` is a list (not `headerData` dict)
- Check each field has valid `(doc, key)` per category config
- Check all required fields are present

**8e. Update pipeline.py extract save** (line 501-506):
- Convert flat `fields` array to `header_data` and `supporting_data` for backward-compatible DB storage
- OR: add a `fields` JSON column to Case and populate that instead

**Decision:** Add `extracted_fields` JSON column to Case. Keep `header_data` and `supporting_data` as computed views populated from `extracted_fields` for backward compat until frontend migrates.

```python
# In pipeline.py after extract:
case.extracted_fields = result.get("fields", [])
case.line_items = result.get("lineItems", [])
# Backward compat:
case.header_data = {f["key"]: f["value"] for f in result["fields"] if f["doc"] == "Invoice"}
case.supporting_data = {}
for f in result["fields"]:
    if f["doc"] != "Invoice":
        case.supporting_data.setdefault(f["doc"], {})[f["key"]] = f["value"]
```

**8f. Update bbox_locator** to work with flat field list instead of confidenceScores dict.

**8g. Add `compute_field_confidence()`** as new function in pipeline.py or a new `agents/confidence.py`.

### Phase B: Frontend migration

**8h. Update DataValidationTab** to read from `extractedFields` (flat list) instead of `headerData`/`supportingData`.

**8i. Update Case TypeScript type** to include `extractedFields: Array<{doc, key, value, page, file?, bbox?, status?, flags?, confidence?}>`.

**8j. Remove `confidenceScores` rendering** from frontend (it was mostly unused/broken anyway).

### Phase C: Cleanup

**8k. Remove `confidence_scores` column from Case** model after frontend fully migrated.
**8l. Remove backward-compat `header_data`/`supporting_data` population** once frontend uses `extractedFields`.

---

## 9. Stored Structure on Case Model

During migration (Phase A+B overlap):

```python
class Case(Base):
    # ... existing ...
    extracted_fields = Column(JSON, default=list)   # NEW: flat field list (source of truth)
    header_data = Column(JSON, default=dict)         # LEGACY: computed from extracted_fields
    supporting_data = Column(JSON, default=dict)     # LEGACY: computed from extracted_fields
    line_items = Column(JSON, default=list)           # KEPT: line items
    confidence_scores = Column(JSON, default=dict)    # DEPRECATED: to be removed
```

`to_dict()` returns:
```python
"extractedFields": self.extracted_fields or [],
"headerData": self.header_data or {},        # backward compat
"supportingData": self.supporting_data or {}, # backward compat
```

---

## 10. Validate Step Changes

The validate prompt currently reads `extract.json` and checks `headerData`/`supportingData`. It needs to read the flat `fields` array instead.

The validate step's output format (`results` array of rule outcomes) does NOT change. Only its input parsing changes.

Updated validate prompt instruction:
```
1. Read results/extract.json — it contains a flat "fields" array where each entry has {doc, key, value, page}.
   - Invoice fields have doc="Invoice"
   - Supporting doc fields have doc="<document type name>"
2. Read FIELD_LIST.md for validation rules.
3. For each rule, find the relevant fields by (doc, key) and apply the validation condition.
```

---

## Summary of Token Savings

| Component | Current (CASE-0034) | v2 |
|-----------|---------------------|-----|
| headerData | 28 fields, 27 lines | 28 entries in fields array, 28 lines |
| supportingData | 2 doc types, 24 fields, 26 lines | Same 24 entries in fields array |
| confidenceScores | 32 entries x 4 lines each = 128 lines | ELIMINATED |
| lineItems | 1 item, 12 lines | 1 item, 8 lines |
| **Total** | **~265 lines** | **~70 lines** |
| **Token estimate** | ~3500 tokens | ~900 tokens |

**74% reduction in extract output tokens.**
