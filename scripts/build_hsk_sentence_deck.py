#!/usr/bin/env python3
"""Build the compact listening deck used by the app from Hugging Face JSONL."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "assets" / "hsk_sentences_audio.json"
SOURCE_URL = (
    "https://huggingface.co/datasets/no7z/hsk-sentences-audio/"
    "resolve/main/data/train.jsonl"
)
DATASET_URL = "https://huggingface.co/datasets/no7z/hsk-sentences-audio"


def compact_sentence(row: dict) -> dict:
    audio = row.get("audio") or {}
    translation = row.get("translation") or {}

    return {
        "id": row["id"],
        "level": int(row["hsk_level"]),
        "topic": row.get("topic", ""),
        "type": row.get("sentence_type", ""),
        "chinese": row["chinese"],
        "traditional": row.get("traditional", ""),
        "pinyin": row.get("pinyin", ""),
        "translation": translation.get("en", ""),
        "audioNormal": audio.get("normal") or row.get("audio_normal", ""),
        "audioSlow": audio.get("slow") or row.get("audio_slow", ""),
    }


def main() -> None:
    request = Request(SOURCE_URL, headers={"User-Agent": "zou-ba-deck-builder/1.0"})
    sentences = []

    with urlopen(request, timeout=90) as response:
        revision = response.headers.get("x-repo-commit", "main")
        for line_number, raw_line in enumerate(response, start=1):
            if not raw_line.strip():
                continue
            try:
                sentences.append(compact_sentence(json.loads(raw_line)))
            except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
                raise ValueError(f"Invalid dataset row at line {line_number}: {error}") from error

    if not sentences:
        raise ValueError("The source dataset returned no sentences.")

    level_counts = Counter(sentence["level"] for sentence in sentences)
    if any(level not in range(1, 7) for level in level_counts):
        raise ValueError(f"Unexpected HSK levels: {sorted(level_counts)}")
    if any(not sentence["audioNormal"] or not sentence["audioSlow"] for sentence in sentences):
        raise ValueError("At least one sentence is missing an audio path.")

    payload = {
        "source": DATASET_URL,
        "sourceRevision": revision,
        "license": "CC-BY-SA-4.0",
        "audioNotice": "Synthetic speech generated with CosyVoice2-0.5B.",
        "count": len(sentences),
        "levelCounts": {str(level): level_counts[level] for level in range(1, 7)},
        "sentences": sentences,
    }
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(sentences):,} sentences to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
