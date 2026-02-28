---
name: invoice-parser
description: >
  Parse invoice, receipt, and paystub PDFs/images into readable text sidecars and
  generate index artifacts for downstream reconciliation workflows.
---

# Invoice Parser

Run the invoice-parser workflow before financial reconciliation whenever source documents are PDF/image files.

## Instructions

1. Run `scripts/extract_readable.sh [finance_root] [year]` to extract text sidecars and rebuild indexes.
2. Keep source files unchanged; write mirrored `.txt` outputs under `finance/<year>/real_moves/readable/`.
3. Review extraction statuses in `index.json` and `index.csv` before any ledger matching.
4. Run `scripts/normalize_invoice.py` on extracted `.txt` files when a machine-friendly summary is needed.
5. Escalate low-quality or failed OCR items for manual review; do not invent values.

## References

- Sidecar/index schema: `references/sidecar-schema.md`
- Path conventions: `references/path-conventions.md`
- Quality checks: `references/quality-rules.md`
