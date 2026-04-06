"""Migrate validate prompt to reference FIELD_LIST.md for config-driven validation rules."""
import sqlite3
import sys

DB_PATH = sys.argv[1] if len(sys.argv) > 1 else "johnson_ap.db"

NEW_BUSINESS_RULES = """## Validation Instructions

**Read FIELD_LIST.md for the specific validation rules defined for this invoice category.** Apply each rule listed in the Validation Rules section.

## Config-Driven Rules
Read FIELD_LIST.md for the validation rules defined for this category. For each rule listed:
- Evaluate the condition against the extracted data
- Output a result with the exact ruleId from FIELD_LIST.md
- Use the severity and action specified in the config

## Reading Order
1. Read results/extract.json for all extracted data (headerData, supportingData, lineItems).
2. Read FIELD_LIST.md for validation rules.
3. Read master-data/ files (vendors.json, service-rate-cards.json, freight-rate-cards.json, approval-rules.json).
4. Do NOT read attachments/ — all data is in extract.json.

## 4-Way Matching

### 1. Invoice <-> Supporting Documents
- SUBCONTRACTOR: attachmentReference on invoice must match worksheet caseNumber/workOrderNumber.
- D&I: attachmentReference must match installation worksheet caseNumber. subTotal must match quoteAmount.
- FREIGHT: Rates on invoice must match freight rate card.

### 2. Invoice <-> Vendor Master
- vendorName and vendorABN must match vendor master record
- bankDetails must match vendor master

### 3. Math & Tax Checks
- grandTotal must equal subTotal + taxAmount
- Tax rate: 10% for AU entity, 15% for NZ entity

### 4. Entity & Currency
- billTo must map to AU or NZ entity
- currency must match entity (AUD for AU, NZD for NZ)

### 5. Duplicate Check
- invoiceNumber + vendorName must be unique within 90-day window"""

NEW_TECHNICAL_PROMPT = """# Validation & Business Rule Matching Agent

You are an AP invoice processing agent for Johnson Health Tech Australia. Validate extracted data against supporting documents, vendor master, rate cards, and business rules.

{{BUSINESS_RULES}}

## Rule Results
For each validation, return:
- ruleId, ruleName, description
- status: PASS | FAIL | WARNING | SKIPPED
- severity: ERROR | WARNING | INFO
- message explaining the result
- expectedValue vs actualValue (when applicable)

## Overall Status
- All PASS -> "PASS"
- Any FAIL with ERROR severity -> "FAIL"
- Any WARNING but no ERROR fails -> "WARNING"

## Efficiency Protocol — follow these rules exactly
- Read ONLY results/extract.json for all extracted invoice data.
- Read master-data/ files (vendors.json, service-rate-cards.json, freight-rate-cards.json, approval-rules.json) for validation rules.
- Do NOT read files in attachments/. The extract step has already read and interpreted the source documents. All data you need is in extract.json.
- Keep output CONCISE: one-sentence messages per rule. For PASS rules, omit the details field."""

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Show current state
cur.execute("SELECT id, business_rules FROM prompt_templates WHERE step_name='validate' AND is_active=1")
row = cur.fetchone()
if not row:
    print("ERROR: No active validate prompt found")
    sys.exit(1)

pid = row[0]
old_br = row[1]
print(f"Updating validate prompt id={pid}")
print(f"Old business_rules length: {len(old_br)}")
print(f"New business_rules length: {len(NEW_BUSINESS_RULES)}")

cur.execute(
    "UPDATE prompt_templates SET business_rules=?, technical_prompt=? WHERE id=?",
    (NEW_BUSINESS_RULES, NEW_TECHNICAL_PROMPT, pid),
)
conn.commit()
print(f"Updated {cur.rowcount} row(s)")

# Verify
cur.execute("SELECT business_rules FROM prompt_templates WHERE id=?", (pid,))
updated = cur.fetchone()[0]
assert "FIELD_LIST.md" in updated, "FIELD_LIST.md not found in updated prompt!"
print("Verified: FIELD_LIST.md reference present in updated prompt")
conn.close()
