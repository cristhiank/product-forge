#!/usr/bin/env bash
# Extract readable sidecars for invoice-like documents under finance/<year>/real_moves.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_FINANCE_ROOT="$(cd "${SCRIPT_DIR}/../../../../finance" && pwd)"

FINANCE_ROOT="${1:-$DEFAULT_FINANCE_ROOT}"
YEAR="${2:-$(date +%Y)}"

BASE_DIR="${FINANCE_ROOT}/${YEAR}/real_moves"
READABLE_DIR="${BASE_DIR}/readable"
INDEX_JSON="${READABLE_DIR}/index.json"
INDEX_CSV="${READABLE_DIR}/index.csv"
TMP_RECORDS="$(mktemp)"

cleanup() {
  rm -f "${TMP_RECORDS}"
}
trap cleanup EXIT

if [[ ! -d "${BASE_DIR}" ]]; then
  echo "ERROR: base directory does not exist: ${BASE_DIR}" >&2
  exit 1
fi

mkdir -p "${READABLE_DIR}"

extract_pdf() {
  local source_file="$1"
  local output_file="$2"
  local tmp_dir
  tmp_dir="$(mktemp -d)"

  if command -v pdftotext >/dev/null 2>&1; then
    pdftotext "${source_file}" "${output_file}" >/dev/null 2>&1 || true
    local text_len=0
    [[ -f "${output_file}" ]] && text_len="$(wc -c < "${output_file}" | tr -d ' ')"
    if [[ "${text_len}" -gt 20 ]]; then
      rm -rf "${tmp_dir}"
      echo "pdftotext"
      return 0
    fi
  fi

  if command -v pdftoppm >/dev/null 2>&1 && command -v tesseract >/dev/null 2>&1; then
    rm -f "${output_file}"
    pdftoppm -png "${source_file}" "${tmp_dir}/page" >/dev/null 2>&1 || true
    shopt -s nullglob
    local png
    for png in "${tmp_dir}"/page-*.png; do
      local ocr_base="${tmp_dir}/ocr"
      tesseract "${png}" "${ocr_base}" >/dev/null 2>&1 || true
      if [[ -f "${ocr_base}.txt" ]]; then
        cat "${ocr_base}.txt" >> "${output_file}"
        printf "\n" >> "${output_file}"
      fi
      rm -f "${ocr_base}.txt"
    done
    shopt -u nullglob
    local ocr_len=0
    [[ -f "${output_file}" ]] && ocr_len="$(wc -c < "${output_file}" | tr -d ' ')"
    if [[ "${ocr_len}" -gt 20 ]]; then
      rm -rf "${tmp_dir}"
      echo "ocr_fallback"
      return 0
    fi
  fi

  rm -rf "${tmp_dir}"
  return 1
}

extract_image() {
  local source_file="$1"
  local output_file="$2"
  if command -v tesseract >/dev/null 2>&1; then
    tesseract "${source_file}" "${output_file%.*}" >/dev/null 2>&1 || true
    local text_len=0
    [[ -f "${output_file}" ]] && text_len="$(wc -c < "${output_file}" | tr -d ' ')"
    if [[ "${text_len}" -gt 5 ]]; then
      echo "tesseract_ocr"
      return 0
    fi
  fi
  return 1
}

total_files=0
success_count=0
failed_count=0

while IFS= read -r source_file; do
  total_files=$((total_files + 1))

  rel_path="${source_file#${BASE_DIR}/}"
  dir_part="$(dirname "${rel_path}")"
  filename="$(basename "${rel_path}")"
  base_name="${filename%.*}"
  output_dir="${READABLE_DIR}/${dir_part}"
  output_file="${output_dir}/${base_name}.txt"
  mkdir -p "${output_dir}"

  ext_lower="$(echo "${filename##*.}" | tr '[:upper:]' '[:lower:]')"
  method=""
  status="success"
  error=""

  case "${ext_lower}" in
    pdf)
      if method="$(extract_pdf "${source_file}" "${output_file}")"; then
        status="success"
      else
        method="failed"
        status="failed"
        error="PDF extraction failed (pdftotext/OCR unavailable or empty output)"
        : > "${output_file}"
      fi
      ;;
    jpg|jpeg|png)
      if method="$(extract_image "${source_file}" "${output_file}")"; then
        status="success"
      else
        method="failed"
        status="failed"
        error="Image OCR failed (tesseract unavailable or empty output)"
        : > "${output_file}"
      fi
      ;;
    *)
      method="unsupported"
      status="failed"
      error="Unsupported extension: ${ext_lower}"
      : > "${output_file}"
      ;;
  esac

  if [[ "${status}" == "success" ]]; then
    success_count=$((success_count + 1))
  else
    failed_count=$((failed_count + 1))
  fi
  text_length=0
  [[ -f "${output_file}" ]] && text_length="$(wc -c < "${output_file}" | tr -d ' ')"
  extracted_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "${source_file}" \
    "${output_file}" \
    "${method}" \
    "${text_length}" \
    "${status}" \
    "${error}" \
    "${extracted_at}" >> "${TMP_RECORDS}"
done < <(
  find "${BASE_DIR}" -type f \
    \( -iname "*.pdf" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) \
    ! -path "${READABLE_DIR}/*" \
    | sort
)

python3 - "${TMP_RECORDS}" "${INDEX_JSON}" "${INDEX_CSV}" <<'PY'
import csv
import json
import sys
from pathlib import Path

records_path, index_json_path, index_csv_path = sys.argv[1:]
fields = [
    "source_path",
    "readable_path",
    "extraction_method",
    "text_length",
    "status",
    "error",
    "extracted_at",
]

rows = []
with open(records_path, "r", encoding="utf-8") as fh:
    for line in fh:
        line = line.rstrip("\n")
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) != 7:
            continue
        source, readable, method, text_len, status, error, extracted_at = parts
        rows.append(
            {
                "source_path": source,
                "readable_path": readable,
                "extraction_method": method,
                "text_length": int(text_len) if text_len.isdigit() else 0,
                "status": status,
                "error": error,
                "extracted_at": extracted_at,
            }
        )

Path(index_json_path).parent.mkdir(parents=True, exist_ok=True)
with open(index_json_path, "w", encoding="utf-8") as fh:
    json.dump(rows, fh, indent=2, ensure_ascii=True)
    fh.write("\n")

with open(index_csv_path, "w", encoding="utf-8", newline="") as fh:
    writer = csv.DictWriter(fh, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
PY

echo "Extraction complete."
echo "Total files: ${total_files}"
echo "Successful: ${success_count}"
echo "Failed: ${failed_count}"
echo "Index JSON: ${INDEX_JSON}"
echo "Index CSV:  ${INDEX_CSV}"
