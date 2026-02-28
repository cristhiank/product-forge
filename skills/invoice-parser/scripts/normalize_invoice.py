#!/usr/bin/env python3
"""Best-effort deterministic invoice text normalizer."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

AMOUNT_RE = re.compile(r"(?<!\w)(?:USD?\s*)?\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})(?!\w)")
DATE_PATTERNS = [
    re.compile(r"\b(20[0-9]{2}-[01][0-9]-[0-3][0-9])\b"),
    re.compile(r"\b([01]?[0-9]/[0-3]?[0-9]/20[0-9]{2})\b"),
    re.compile(r"\b([0-3]?[0-9]/[01]?[0-9]/20[0-9]{2})\b"),
]


def normalize_whitespace(text: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def parse_amounts(text: str) -> list[str]:
    seen = []
    for match in AMOUNT_RE.findall(text):
        cleaned = match.replace(",", "")
        if cleaned not in seen:
            seen.append(cleaned)
    return seen


def parse_dates(text: str) -> list[str]:
    seen = []
    for pattern in DATE_PATTERNS:
        for match in pattern.findall(text):
            if match not in seen:
                seen.append(match)
    return seen


def guess_vendor(lines: list[str]) -> str | None:
    for line in lines[:5]:
        if len(line) >= 3 and not re.search(r"\d", line):
            return line
    return lines[0] if lines else None


def build_summary(raw_text: str, source_path: str | None) -> dict:
    normalized_text = normalize_whitespace(raw_text)
    lines = normalized_text.splitlines()
    amounts = parse_amounts(normalized_text)
    dates = parse_dates(normalized_text)
    checksum = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()

    total_candidates = []
    for line in lines:
        lower = line.lower()
        if "total" in lower:
            total_candidates.extend(AMOUNT_RE.findall(line))
    totals = []
    for amount in total_candidates:
        cleaned = amount.replace(",", "")
        if cleaned not in totals:
            totals.append(cleaned)

    return {
        "source_path": source_path,
        "document_type": "invoice_or_receipt_or_paystub",
        "vendor_name": guess_vendor(lines),
        "detected_dates": dates,
        "detected_amounts": amounts,
        "total_amount_candidates": totals,
        "currency": "unknown",
        "line_items": [],
        "notes": [],
        "raw_text": {
            "sha256": checksum,
            "length": len(raw_text),
            "preview": raw_text[:500],
        },
        "normalized_text": normalized_text,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize extracted invoice text into a JSON summary template.")
    parser.add_argument("input_file", help="Path to extracted .txt file")
    parser.add_argument("--source", help="Original source document path", default=None)
    parser.add_argument("--output", help="Path for JSON output (default: stdout)", default=None)
    args = parser.parse_args()

    input_path = Path(args.input_file)
    raw_text = input_path.read_text(encoding="utf-8", errors="replace")
    summary = build_summary(raw_text=raw_text, source_path=args.source)

    if args.output:
        output_path = Path(args.output)
        output_path.write_text(json.dumps(summary, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    else:
        print(json.dumps(summary, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
