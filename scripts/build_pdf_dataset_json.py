from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "assets" / "hsk_1_6_pdf_dataset_english.csv"
DEFAULT_OUTPUT = ROOT / "assets" / "hsk_1_6_pdf_dataset_english.json"
DEFAULT_VALID_PINYIN = ROOT / "src" / "data" / "validPinyin.js"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pinyin_helpers import load_valid_syllables, normalize_pinyin


def normalize_row(row: dict[str, str], valid_syllables: set[str]) -> dict[str, object]:
    row_id = int(row["id"])
    level = int(row["hsk_level"])
    hanzi = row["hanzi"].strip()
    simple_english = row["english_translation"].strip()
    detailed_english = row["detailed_english_translation"].strip()

    if not hanzi:
        raise ValueError(f"Row {row_id} is missing hanzi.")
    if not simple_english:
        raise ValueError(f"Row {row_id} is missing english_translation.")
    if not detailed_english:
        raise ValueError(f"Row {row_id} is missing detailed_english_translation.")

    pinyin = normalize_pinyin(row["pinyin"], valid_syllables, f"{hanzi} row {row_id}")

    return {
        "id": row_id,
        "level": level,
        "hanzi": hanzi,
        "pinyin": pinyin,
        "rawEnglish": simple_english,
        "translations": {
            "eng": [simple_english],
        },
        "detailedEnglishTranslation": detailed_english,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert the PDF English CSV dataset into the app JSON deck format."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"CSV dataset path (default: {DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"JSON output path (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--valid-pinyin",
        type=Path,
        default=DEFAULT_VALID_PINYIN,
        help=f"Valid pinyin syllables JS file (default: {DEFAULT_VALID_PINYIN})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    valid_syllables = load_valid_syllables(args.valid_pinyin)

    with args.input.open(encoding="utf-8-sig", newline="") as input_file:
        reader = csv.DictReader(input_file)
        items = [normalize_row(row, valid_syllables) for row in reader]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(items, ensure_ascii=False, indent=4) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(items)} entries to {args.output}")


if __name__ == "__main__":
    main()
