# Pipeline Schema Optimization — Design Document

**Date:** 2026-04-06
**Status:** Research complete — implementation deferred to future wave

## Summary

All 4 non-extract pipeline steps waste 25-81% of output tokens on prose reasoning and redundant fields. Combined with the extract schema v2 redesign (already implemented), optimizing all steps would reduce total pipeline output tokens by ~60%.

## Per-Step Findings

### Classify (81% waste → 64% reduction)
- `signals` object is 81% prose — LLM narrating what it read
- Drop `signals`, replace with structured `attachmentSummary` [{filename, docType, vendor, invoiceNo, amount}]
- Drop `confidence` (always 0.85-0.95, unused)
- Categorize step uses attachment analysis — structured fields are more reliable than prose

### Categorize (69% waste → 75-90% reduction)
- `reasoning` is 69% prose — no downstream consumer
- **Move vendor matching to code** — 15-entry fuzzy match is deterministic, LLM always produces 0.3 confidence
- LLM outputs only: category, entity, poType, invoiceVendorName
- Code does fuzzy match against vendors.json, resolves vendorId/vendorNumber/contractNumber

### Verify_docs (43% waste → 65% reduction)
- `notes` per document is 43% prose — no consumer
- Drop `presentDocs`/`missingDocs` — derive from `details[].status`
- Drop `confidence` (always 0.95)
- Keep `details` array (consumed by attachment tagging + bbox routing)

### Validate (25% waste → 25-35% reduction)
- Drop dead fields: `description`, `matchedAgainst`, `details`
- Drop `overallStatus` — compute in code
- **Add `fields` array** per rule: [{doc, key}] — enables "click rule → highlight field"
- Keep `severity` for now (remove when rule configs carry it)

## Implementation Priority

1. **Categorize vendor matching → code** (highest impact: removes hallucinated vendor IDs)
2. **Classify → structured attachmentSummary** (saves tokens, feeds categorize better)
3. **Verify_docs → drop prose** (straightforward, low risk)
4. **Validate → add fields traceability** (high UI value)

## Token Budget (estimated per pipeline run)

| Step | Current | Optimized | Savings |
|------|---------|-----------|---------|
| classify | ~250 | ~90 | 64% |
| categorize | ~184 | ~19 | 90% |
| verify_docs | ~208 | ~72 | 65% |
| extract | ~3500 | ~900 | 74% (done) |
| validate | ~370 | ~260 | 30% |
| **Total** | **~4512** | **~1341** | **70%** |
