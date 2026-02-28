# Sidecar and Index Schema

Use this schema for outputs produced by `scripts/extract_readable.sh`.

## Sidecar file

- One `.txt` file per source document.
- Mirror source tree below `finance/<year>/real_moves/`.
- Write to `finance/<year>/real_moves/readable/<relative_dir>/<basename>.txt`.

## index.json

Array of objects with these fields:

```json
{
  "source_path": "/abs/path/to/source.pdf",
  "readable_path": "/abs/path/to/readable.txt",
  "extraction_method": "pdftotext|ocr_fallback|tesseract_ocr|failed|unsupported",
  "text_length": 1234,
  "status": "success|failed",
  "error": "",
  "extracted_at": "2026-02-16T23:59:59Z"
}
```

## index.csv

Header and columns must match:

`source_path,readable_path,extraction_method,text_length,status,error,extracted_at`
