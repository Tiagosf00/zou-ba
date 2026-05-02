#!/usr/bin/env python3
"""Build compact per-word source indexes for HSK audio files."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "assets" / "audio" / "hsk_audio_manifest.json"
DEFAULT_DATASETS = [
    ROOT / "assets" / "hsk_1_6_pdf_dataset_english.json",
    ROOT / "assets" / "hsk.json",
]
DEFAULT_JSON = ROOT / "assets" / "audio" / "hsk_audio_sources.json"
DEFAULT_CSV = ROOT / "assets" / "audio" / "hsk_audio_sources.csv"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Write compact HSK audio source indexes.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument(
        "--dataset",
        type=Path,
        action="append",
        help="Dataset JSON to refresh pinyin/level metadata from. Can be passed more than once.",
    )
    parser.add_argument("--json-output", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--csv-output", type=Path, default=DEFAULT_CSV)
    return parser.parse_args()


def load_dataset_index(dataset_path: Path) -> dict[str, dict[str, object]]:
    if not dataset_path.exists():
        return {}

    index: dict[str, dict[str, object]] = {}
    for entry in json.loads(dataset_path.read_text(encoding="utf-8")):
        hanzi = str(entry.get("hanzi") or "")
        if not hanzi:
            continue

        record = index.setdefault(
            hanzi,
            {
                "pinyin": entry.get("pinyin"),
                "levels": [],
                "entryIds": [],
            },
        )

        level = entry.get("level")
        if isinstance(record["levels"], list) and level not in record["levels"]:
            record["levels"].append(level)

        entry_id = entry.get("id")
        if isinstance(record["entryIds"], list) and entry_id not in record["entryIds"]:
            record["entryIds"].append(entry_id)

        if not record.get("pinyin") and entry.get("pinyin"):
            record["pinyin"] = entry.get("pinyin")

    return index


def merge_dataset_indexes(dataset_paths: list[Path]) -> dict[str, dict[str, object]]:
    merged: dict[str, dict[str, object]] = {}
    for dataset_path in dataset_paths:
        for hanzi, item in load_dataset_index(dataset_path).items():
            merged.setdefault(hanzi, item)

    return merged


def compact_item(item: dict[str, object], dataset_index: dict[str, dict[str, object]]) -> dict[str, object]:
    hanzi = item.get("hanzi")
    dataset_item = dataset_index.get(str(hanzi)) if hanzi else None

    return {
        "hanzi": hanzi,
        "pinyin": dataset_item.get("pinyin") if dataset_item else item.get("pinyin"),
        "levels": dataset_item.get("levels") if dataset_item else item.get("levels"),
        "entryIds": dataset_item.get("entryIds") if dataset_item else item.get("entryIds"),
        "file": item.get("file"),
        "bytes": item.get("bytes"),
        "status": item.get("status"),
        "source": item.get("source"),
        "sourceUrl": item.get("sourceUrl"),
        "sourceUrls": item.get("sourceUrls"),
        "license": item.get("license"),
        "qualityNote": item.get("qualityNote"),
    }


def main() -> int:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    dataset_index = merge_dataset_indexes(args.dataset or DEFAULT_DATASETS)
    items = [compact_item(item, dataset_index) for item in manifest.get("items", [])]
    source_counts: dict[str, int] = {}
    license_counts: dict[str, int] = {}

    for item in items:
        source = str(item.get("source") or "unknown")
        license_name = str(item.get("license") or "unknown")
        source_counts[source] = source_counts.get(source, 0) + 1
        license_counts[license_name] = license_counts.get(license_name, 0) + 1

    payload = {
        "total": len(items),
        "sourceCounts": dict(sorted(source_counts.items())),
        "licenseCounts": dict(sorted(license_counts.items())),
        "items": items,
    }

    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    fieldnames = [
        "hanzi",
        "pinyin",
        "levels",
        "entryIds",
        "file",
        "bytes",
        "status",
        "source",
        "sourceUrl",
        "sourceUrls",
        "license",
        "qualityNote",
    ]
    with args.csv_output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            row = dict(item)
            for key in ("levels", "entryIds", "sourceUrls"):
                if isinstance(row.get(key), list):
                    row[key] = " ".join(str(value) for value in row[key])
            writer.writerow(row)

    print(f"Wrote {len(items)} sources to {args.json_output}")
    print(f"Wrote {len(items)} sources to {args.csv_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
