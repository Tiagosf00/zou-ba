#!/usr/bin/env python3
"""Build the app's listening corpus from the New HSK 3.0 Anki packages."""

from __future__ import annotations

import argparse
import io
import json
import re
import shutil
import sqlite3
import tempfile
import zipfile
from collections import Counter
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "assets" / "hsk_sentences_audio.json"
AUDIO_ROOT = PROJECT_ROOT / "public" / "audio" / "hsk-sentences"
SOURCE_URL = "https://ankiweb.net/shared/info/258311532"
SOURCE_RELEASE_URL = "https://github.com/NewHSK3/new-hsk-3-anki-deck/releases/tag/v1.0"
SOUND_PATTERN = re.compile(r"\[sound:(.+?)]")
LEVEL_PATTERN = re.compile(r"HSK\s+([1-6])\b", re.IGNORECASE)
IGNORED_CHARACTERS = set(
    " \t\r\n\u3000,，.。!！?？、;；:：'\"“”‘’…—-()（）[]【】《》〈〉"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract HSK 1-6 sentence metadata and MP3s from Anki deck packages."
    )
    parser.add_argument(
        "packages",
        nargs="+",
        type=Path,
        help="The HSK 1-4, HSK 5 and HSK 6 .apkg files.",
    )
    return parser.parse_args()


def read_varint(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while offset < len(data):
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if byte < 0x80:
            return value, offset
        shift += 7
        if shift > 63:
            break
    raise ValueError("Invalid protobuf varint in Anki media index.")


def parse_media_entry(message: bytes) -> str:
    offset = 0
    filename = ""
    while offset < len(message):
        tag, offset = read_varint(message, offset)
        field_number = tag >> 3
        wire_type = tag & 7
        if wire_type == 0:
            _, offset = read_varint(message, offset)
        elif wire_type == 2:
            length, offset = read_varint(message, offset)
            value = message[offset : offset + length]
            offset += length
            if field_number == 1:
                filename = value.decode("utf-8")
        else:
            raise ValueError(f"Unsupported protobuf wire type: {wire_type}")
    if not filename:
        raise ValueError("An Anki media entry is missing its filename.")
    return filename


def parse_modern_media_index(data: bytes) -> dict[str, str]:
    entries = {}
    offset = 0
    index = 0
    while offset < len(data):
        tag, offset = read_varint(data, offset)
        if tag != 10:
            raise ValueError("Unexpected field in modern Anki media index.")
        length, offset = read_varint(data, offset)
        message = data[offset : offset + length]
        offset += length
        entries[str(index)] = parse_media_entry(message)
        index += 1
    return entries


def zstd_decompress(data: bytes) -> bytes:
    try:
        import zstandard
    except ImportError as error:
        raise RuntimeError(
            "Modern Anki packages require zstandard. Install it with: "
            "python3 -m pip install zstandard"
        ) from error

    with zstandard.ZstdDecompressor().stream_reader(io.BytesIO(data)) as reader:
        return reader.read()


def read_package_database(archive: zipfile.ZipFile) -> tuple[bytes, bool]:
    names = set(archive.namelist())
    if "collection.anki21b" in names:
        return zstd_decompress(archive.read("collection.anki21b")), True
    if "collection.anki21" in names:
        return archive.read("collection.anki21"), False
    raise ValueError("The package does not contain an Anki 2.1 collection database.")


def read_media_index(archive: zipfile.ZipFile, is_modern: bool) -> dict[str, str]:
    raw_media = archive.read("media")
    if is_modern:
        return parse_modern_media_index(zstd_decompress(raw_media))
    return json.loads(raw_media.decode("utf-8"))


def listening_models(connection: sqlite3.Connection) -> list[tuple[int, str, list[str]]]:
    legacy_models = connection.execute("SELECT models FROM col").fetchone()[0]
    if legacy_models:
        models = json.loads(legacy_models)
        return [
            (
                int(model_id),
                model["name"],
                [field["name"] for field in model["flds"]],
            )
            for model_id, model in models.items()
            if "Listening" in model["name"]
        ]

    rows = connection.execute(
        "SELECT id, name FROM notetypes WHERE name LIKE '%Listening%' ORDER BY id"
    ).fetchall()
    return [
        (
            model_id,
            name,
            [
                row[0]
                for row in connection.execute(
                    "SELECT name FROM fields WHERE ntid = ? ORDER BY ord", (model_id,)
                )
            ],
        )
        for model_id, name in rows
    ]


def normalize_sentence(value: str) -> str:
    return "".join(character for character in value if character not in IGNORED_CHARACTERS)


def collect_package_records(package_path: Path) -> list[dict]:
    if not package_path.is_file():
        raise FileNotFoundError(f"Anki package not found: {package_path}")

    records = []
    with zipfile.ZipFile(package_path) as archive:
        database_bytes, is_modern = read_package_database(archive)
        media_by_member = read_media_index(archive, is_modern)
        member_by_media = {filename: member for member, filename in media_by_member.items()}

        with tempfile.NamedTemporaryFile(suffix=".anki21") as database_file:
            database_file.write(database_bytes)
            database_file.flush()
            connection = sqlite3.connect(database_file.name)
            try:
                for model_id, model_name, field_names in listening_models(connection):
                    level_match = LEVEL_PATTERN.search(model_name)
                    if not level_match:
                        continue
                    level = int(level_match.group(1))
                    for note_id, raw_fields in connection.execute(
                        "SELECT id, flds FROM notes WHERE mid = ? ORDER BY id", (model_id,)
                    ):
                        values = raw_fields.split("\x1f")
                        if len(values) != len(field_names):
                            raise ValueError(
                                f"Unexpected field count in {package_path.name}, note {note_id}."
                            )
                        fields = dict(zip(field_names, values))
                        sound_match = SOUND_PATTERN.search(fields.get("Han", ""))
                        if not sound_match:
                            raise ValueError(
                                f"Listening note {note_id} has no sentence audio reference."
                            )
                        media_filename = sound_match.group(1)
                        media_member = member_by_media.get(media_filename)
                        if media_member is None:
                            raise ValueError(f"Missing packaged media: {media_filename}")
                        records.append(
                            {
                                "level": level,
                                "noteId": note_id,
                                "focusWord": fields.get("Focus Word Simplified", ""),
                                "chinese": fields["Mandarin Sentence Simplified"],
                                "traditional": fields.get("Mandarin Sentence Traditional", ""),
                                "pinyin": fields.get("Mandarin Sentence Pinyin", ""),
                                "translation": fields.get("English Sentence", ""),
                                "voice": "alternate" if fields.get("Yun", "").strip() else "primary",
                                "package": package_path,
                                "mediaMember": media_member,
                                "modernMedia": is_modern,
                            }
                        )
            finally:
                connection.close()
    return records


def extract_audio(record: dict, destination: Path, archive: zipfile.ZipFile) -> None:
    with archive.open(record["mediaMember"]) as source, destination.open("wb") as output:
        if record["modernMedia"]:
            try:
                import zstandard
            except ImportError as error:
                raise RuntimeError("Install zstandard to extract modern Anki media.") from error
            with zstandard.ZstdDecompressor().stream_reader(source) as decompressed:
                shutil.copyfileobj(decompressed, output, length=1024 * 1024)
        else:
            shutil.copyfileobj(source, output, length=1024 * 1024)


def main() -> None:
    args = parse_args()
    packages = [path.expanduser().resolve() for path in args.packages]
    all_records = []
    for package in packages:
        print(f"Reading {package.name}...", flush=True)
        all_records.extend(collect_package_records(package))

    all_records.sort(key=lambda record: (record["level"], record["noteId"]))
    deduplicated_records = []
    seen_sentences = set()
    duplicate_count = 0
    for record in all_records:
        normalized = normalize_sentence(record["chinese"])
        if not normalized or normalized in seen_sentences:
            duplicate_count += 1
            continue
        seen_sentences.add(normalized)
        deduplicated_records.append(record)

    level_counts = Counter(record["level"] for record in deduplicated_records)
    if set(level_counts) != set(range(1, 7)):
        raise ValueError(f"Expected HSK levels 1-6, found: {sorted(level_counts)}")

    staging_audio = AUDIO_ROOT / "audio-next"
    current_audio = AUDIO_ROOT / "audio"
    previous_audio = AUDIO_ROOT / "audio-previous"
    if staging_audio.exists():
        shutil.rmtree(staging_audio)
    staging_audio.mkdir(parents=True)

    sentences = []
    level_indexes = Counter()
    archives = {package: zipfile.ZipFile(package) for package in packages}
    try:
        for position, record in enumerate(deduplicated_records, start=1):
            level = record["level"]
            level_indexes[level] += 1
            sentence_id = f"hsk{level}-{level_indexes[level]:04d}"
            audio_path = f"audio/{sentence_id}.mp3"
            destination = staging_audio / f"{sentence_id}.mp3"
            extract_audio(record, destination, archives[record["package"]])
            if destination.stat().st_size <= 512:
                raise ValueError(f"Extracted audio is unexpectedly small: {destination.name}")
            sentences.append(
                {
                    "id": sentence_id,
                    "level": level,
                    "topic": "general",
                    "type": "sentence",
                    "focusWord": record["focusWord"],
                    "chinese": record["chinese"],
                    "traditional": record["traditional"],
                    "pinyin": record["pinyin"],
                    "translation": record["translation"],
                    "voice": record["voice"],
                    "audioNormal": audio_path,
                    "audioSlow": audio_path,
                }
            )
            if position % 1000 == 0 or position == len(deduplicated_records):
                print(f"Extracted {position:,} / {len(deduplicated_records):,} MP3s", flush=True)

        if previous_audio.exists():
            shutil.rmtree(previous_audio)
        if current_audio.exists():
            current_audio.rename(previous_audio)
        staging_audio.rename(current_audio)
        if previous_audio.exists():
            shutil.rmtree(previous_audio)
    except Exception:
        if staging_audio.exists():
            shutil.rmtree(staging_audio)
        raise
    finally:
        for archive in archives.values():
            archive.close()

    total_bytes = sum(path.stat().st_size for path in current_audio.glob("*.mp3"))
    payload = {
        "source": SOURCE_URL,
        "sourceRelease": SOURCE_RELEASE_URL,
        "sourceName": "New HSK 3.0 Mandarin Chinese Sentence Deck",
        "creator": "NewHSK3",
        "permittedUse": "Personal, classroom and educational use; noncommercial.",
        "audioNotice": "AI-generated standard Mainland Mandarin with alternating voices.",
        "count": len(sentences),
        "levelCounts": {str(level): level_counts[level] for level in range(1, 7)},
        "sentences": sentences,
    }
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )

    manifest = {
        "source": SOURCE_URL,
        "sourceRelease": SOURCE_RELEASE_URL,
        "creator": "NewHSK3",
        "usage": payload["permittedUse"],
        "sourcePackages": [package.name for package in packages],
        "sourceNoteCount": len(all_records),
        "duplicateSentenceCount": duplicate_count,
        "fileCount": len(sentences),
        "totalBytes": total_bytes,
        "levelCounts": payload["levelCounts"],
    }
    AUDIO_ROOT.mkdir(parents=True, exist_ok=True)
    (AUDIO_ROOT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Ready: {len(sentences):,} unique sentences, {duplicate_count:,} duplicates removed, "
        f"{total_bytes / 1024 / 1024:.1f} MiB of audio."
    )


if __name__ == "__main__":
    main()
