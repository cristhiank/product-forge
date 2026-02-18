# Quality Rules

Apply these checks after each extraction run.

1. Confirm every discovered source document has a mirrored `.txt` sidecar.
2. Confirm `index.json` and `index.csv` are regenerated with required fields.
3. Treat `status=failed` as a review queue; keep `error` populated.
4. For PDFs, prefer `pdftotext`; use OCR fallback only when text extraction is empty/insufficient.
5. For images, use OCR and record method as `tesseract_ocr`.
6. Do not fabricate invoice values; unresolved data stays blank and is flagged for manual review.
7. Run `normalize_invoice.py` only on extracted text sidecars, never on binary files.
