#!/usr/bin/env python3
"""Generate missing HSK word audio by concatenating audio-cmn syllables.

This is a fallback for HSK words that do not have a native word recording in
hugolpz/audio-cmn. It keeps the same CC-BY-SA source family, but the generated
files are less natural than real word recordings.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "assets" / "hsk.json"
DEFAULT_MANIFEST = ROOT / "assets" / "audio" / "hsk_audio_manifest.json"
DEFAULT_OUTPUT_DIR = ROOT / "assets" / "audio" / "hsk"
DEFAULT_GENERATED_MANIFEST = ROOT / "assets" / "audio" / "hsk_syllable_generated_manifest.json"
DEFAULT_CACHE_DIR = Path(tempfile.gettempdir()) / "zou-ba-audio-cmn-syllables"

REPO_OWNER = "hugolpz"
REPO_NAME = "audio-cmn"
REPO_REF = "master"
TREE_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/git/trees/{REPO_REF}?recursive=1"
RAW_BASE_URL = f"https://raw.githubusercontent.com/{REPO_OWNER}/{REPO_NAME}/{REPO_REF}"
QUALITY = "64k"
USER_AGENT = "zou-ba-hsk-syllable-audio-generator/1.0 (+https://github.com/hugolpz/audio-cmn)"

TONE_MARKS = {
    "ā": ("a", "1"),
    "á": ("a", "2"),
    "ǎ": ("a", "3"),
    "à": ("a", "4"),
    "ē": ("e", "1"),
    "é": ("e", "2"),
    "ě": ("e", "3"),
    "è": ("e", "4"),
    "ī": ("i", "1"),
    "í": ("i", "2"),
    "ǐ": ("i", "3"),
    "ì": ("i", "4"),
    "ō": ("o", "1"),
    "ó": ("o", "2"),
    "ǒ": ("o", "3"),
    "ò": ("o", "4"),
    "ū": ("u", "1"),
    "ú": ("u", "2"),
    "ǔ": ("u", "3"),
    "ù": ("u", "4"),
    "ǖ": ("v", "1"),
    "ǘ": ("v", "2"),
    "ǚ": ("v", "3"),
    "ǜ": ("v", "4"),
    "ü": ("v", "5"),
    "ń": ("n", "2"),
    "ň": ("n", "3"),
    "ǹ": ("n", "4"),
    "ḿ": ("m", "2"),
}


@dataclass(frozen=True)
class WordAudioPlan:
    hanzi: str
    pinyin: str
    syllables: tuple[str, ...]
    syllable_paths: tuple[Path, ...]
    source_urls: tuple[str, ...]
    output_path: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate missing HSK audio files by concatenating audio-cmn syllable MP3s."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="HSK JSON dataset to read.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST, help="Main audio manifest to update.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Directory for generated word MP3s.")
    parser.add_argument(
        "--generated-manifest",
        type=Path,
        default=DEFAULT_GENERATED_MANIFEST,
        help="Detailed manifest for generated fallback files.",
    )
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR, help="Cache for syllable MP3 downloads.")
    parser.add_argument("--workers", type=int, default=12, help="Parallel workers for syllable downloads.")
    parser.add_argument("--force", action="store_true", help="Regenerate existing generated files.")
    parser.add_argument("--dry-run", action="store_true", help="Compute coverage without writing generated files.")
    return parser.parse_args()


def run_curl(url: str) -> str:
    result = subprocess.run(
        [
            "curl",
            "--fail",
            "--location",
            "--silent",
            "--show-error",
            "--connect-timeout",
            "8",
            "--max-time",
            "60",
            "--retry",
            "3",
            "--retry-delay",
            "1",
            "--retry-connrefused",
            "--user-agent",
            USER_AGENT,
            url,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def fetch_syllable_names() -> set[str]:
    tree = json.loads(run_curl(TREE_URL))
    if tree.get("truncated"):
        raise RuntimeError("GitHub returned a truncated repository tree; cannot trust syllable coverage.")

    prefix = f"{QUALITY}/syllabs/cmn-"
    return {
        item["path"].removeprefix(prefix).removesuffix(".mp3")
        for item in tree.get("tree", [])
        if isinstance(item, dict)
        and isinstance(item.get("path"), str)
        and item["path"].startswith(prefix)
        and item["path"].endswith(".mp3")
    }


def raw_syllable_from_pinyin(syllable: str) -> tuple[str, str]:
    syllable = syllable.lower().strip().replace("'", "").replace("’", "")
    tone = "5"
    base_chars: list[str] = []

    for char in syllable:
        if char in TONE_MARKS:
            base, tone = TONE_MARKS[char]
            base_chars.append(base)
        elif char.isalpha():
            base_chars.append(char)

    base = "".join(base_chars)
    if base == "r":
        base = "er"
    return base, tone


def syllable_candidates(base: str, tone: str) -> list[str]:
    candidates = [f"{base}{tone}"]

    # audio-cmn deleted neutral-tone copies where tone 1 duplicates exist.
    if tone == "5":
        candidates.append(f"{base}1")

    # The corpus uses jv4 for the syllable usually written as ju4/jù.
    if base.startswith("ju"):
        candidates.append(f"jv{base[2:]}{tone}")
    elif base.startswith("jv"):
        candidates.append(f"ju{base[2:]}{tone}")

    return candidates


def resolve_pinyin(pinyin: str, syllable_names: set[str]) -> tuple[list[str], list[str]]:
    resolved: list[str] = []
    missing: list[str] = []

    for syllable in re.split(r"\s+", pinyin.strip()):
        if not syllable:
            continue

        base, tone = raw_syllable_from_pinyin(syllable)
        match = next((candidate for candidate in syllable_candidates(base, tone) if candidate in syllable_names), None)
        if match:
            resolved.append(match)
        else:
            missing.append(f"{base}{tone}")

    return resolved, missing


def source_url_for_syllable(syllable: str) -> str:
    return f"{RAW_BASE_URL}/{QUALITY}/syllabs/cmn-{syllable}.mp3"


def cache_path_for_syllable(cache_dir: Path, syllable: str) -> Path:
    return cache_dir / f"cmn-{syllable}.mp3"


def download_syllable(cache_dir: Path, syllable: str) -> tuple[str, str | None]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    output_path = cache_path_for_syllable(cache_dir, syllable)
    if output_path.exists() and output_path.stat().st_size > 0:
        return syllable, None

    temp_path = output_path.with_suffix(output_path.suffix + ".part")
    try:
        subprocess.run(
            [
                "curl",
                "--fail",
                "--location",
                "--silent",
                "--show-error",
                "--connect-timeout",
                "8",
                "--max-time",
                "30",
                "--retry",
                "3",
                "--retry-delay",
                "1",
                "--retry-connrefused",
                "--user-agent",
                USER_AGENT,
                "--output",
                str(temp_path),
                source_url_for_syllable(syllable),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        if not temp_path.exists() or temp_path.stat().st_size == 0:
            raise RuntimeError("empty syllable download")
        temp_path.replace(output_path)
        return syllable, None
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        if temp_path.exists():
            temp_path.unlink()
        if isinstance(error, subprocess.CalledProcessError):
            return syllable, (error.stderr or error.stdout or str(error)).strip()
        return syllable, str(error)


def load_words_by_hanzi(input_path: Path) -> dict[str, dict[str, object]]:
    rows = json.loads(input_path.read_text(encoding="utf-8"))
    return {row["hanzi"]: row for row in rows if row.get("hanzi")}


def load_manifest(manifest_path: Path) -> dict[str, object]:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def build_plans(
    manifest: dict[str, object],
    words_by_hanzi: dict[str, dict[str, object]],
    syllable_names: set[str],
    cache_dir: Path,
    output_dir: Path,
) -> tuple[list[WordAudioPlan], list[dict[str, object]]]:
    plans: list[WordAudioPlan] = []
    unresolved: list[dict[str, object]] = []

    for item in manifest["items"]:
        if item.get("status") != "missing":
            continue

        hanzi = item["hanzi"]
        word = words_by_hanzi.get(hanzi)
        if not word:
            unresolved.append({"hanzi": hanzi, "error": "word not found in HSK input"})
            continue

        pinyin = str(word["pinyin"])
        syllables, missing = resolve_pinyin(pinyin, syllable_names)
        if missing:
            unresolved.append({"hanzi": hanzi, "pinyin": pinyin, "missingSyllables": missing})
            continue

        plans.append(
            WordAudioPlan(
                hanzi=hanzi,
                pinyin=pinyin,
                syllables=tuple(syllables),
                syllable_paths=tuple(cache_path_for_syllable(cache_dir, syllable) for syllable in syllables),
                source_urls=tuple(source_url_for_syllable(syllable) for syllable in syllables),
                output_path=output_dir / f"cmn-{hanzi}.mp3",
            )
        )

    return plans, unresolved


def generate_word_audio(plan: WordAudioPlan, force: bool) -> dict[str, object]:
    if plan.output_path.exists() and not force and plan.output_path.stat().st_size > 0:
        return {
            "hanzi": plan.hanzi,
            "status": "exists",
            "file": str(plan.output_path),
            "bytes": plan.output_path.stat().st_size,
        }

    plan.output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = plan.output_path.with_suffix(plan.output_path.suffix + ".part")

    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    for syllable_path in plan.syllable_paths:
        command.extend(["-i", str(syllable_path)])

    inputs = "".join(f"[{index}:a]" for index in range(len(plan.syllable_paths)))
    filter_complex = f"{inputs}concat=n={len(plan.syllable_paths)}:v=0:a=1[a]"
    command.extend(
        [
            "-filter_complex",
            filter_complex,
            "-map",
            "[a]",
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "64k",
            "-ar",
            "22050",
            "-ac",
            "1",
            "-f",
            "mp3",
            str(temp_path),
        ]
    )

    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
        if not temp_path.exists() or temp_path.stat().st_size == 0:
            raise RuntimeError("empty generated audio")
        temp_path.replace(plan.output_path)
        return {
            "hanzi": plan.hanzi,
            "status": "generated",
            "file": str(plan.output_path),
            "bytes": plan.output_path.stat().st_size,
        }
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        if temp_path.exists():
            temp_path.unlink()
        if isinstance(error, subprocess.CalledProcessError):
            error_text = (error.stderr or error.stdout or str(error)).strip()
        else:
            error_text = str(error)
        return {"hanzi": plan.hanzi, "status": "error", "error": error_text, "file": str(plan.output_path)}


def update_manifests(
    manifest_path: Path,
    generated_manifest_path: Path,
    manifest: dict[str, object],
    plans: list[WordAudioPlan],
    results: list[dict[str, object]],
    unresolved: list[dict[str, object]],
) -> None:
    plans_by_hanzi = {plan.hanzi: plan for plan in plans}
    results_by_hanzi = {result["hanzi"]: result for result in results}
    generated_items = []

    for item in manifest["items"]:
        hanzi = item["hanzi"]
        result = results_by_hanzi.get(hanzi)
        plan = plans_by_hanzi.get(hanzi)
        if not result or not plan or result["status"] not in {"generated", "exists"}:
            continue

        item.update(
            {
                "status": "generated",
                "file": result["file"],
                "source": "audio-cmn-syllable-concat",
                "sourceUrls": list(plan.source_urls),
                "syllables": list(plan.syllables),
                "bytes": result["bytes"],
                "license": "CC-BY-SA",
                "qualityNote": "Generated by concatenating syllable recordings; less natural than native word audio.",
            }
        )
        generated_items.append(
            {
                "hanzi": hanzi,
                "pinyin": plan.pinyin,
                "file": result["file"],
                "bytes": result["bytes"],
                "syllables": list(plan.syllables),
                "sourceUrls": list(plan.source_urls),
            }
        )

    manifest["generatedFromSyllables"] = len(generated_items)
    manifest["downloadedOrExisting"] = sum(
        1 for item in manifest["items"] if item.get("status") in {"downloaded", "exists", "generated"}
    )
    manifest["missing"] = sum(1 for item in manifest["items"] if item.get("status") == "missing")
    manifest["errors"] = sum(1 for item in manifest["items"] if item.get("status") == "error")

    generated_manifest = {
        "source": "audio-cmn syllable recordings",
        "sourceRepository": f"https://github.com/{REPO_OWNER}/{REPO_NAME}",
        "license": "CC-BY-SA; see upstream README for speaker/source attribution",
        "qualityNote": "Generated by concatenating syllable recordings; less natural than native word audio.",
        "generated": len(generated_items),
        "unresolved": unresolved,
        "items": generated_items,
    }

    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    generated_manifest_path.write_text(
        json.dumps(generated_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def print_progress(done: int, total: int, result: dict[str, object]) -> None:
    if done == total or done % 100 == 0 or result.get("status") == "error":
        print(f"[{done}/{total}] {result.get('status')}: {result.get('hanzi')}", flush=True)


def main() -> int:
    args = parse_args()
    if args.workers < 1:
        raise SystemExit("--workers must be at least 1")

    words_by_hanzi = load_words_by_hanzi(args.input)
    manifest = load_manifest(args.manifest)
    syllable_names = fetch_syllable_names()
    plans, unresolved = build_plans(manifest, words_by_hanzi, syllable_names, args.cache_dir, args.output_dir)
    needed_syllables = sorted({syllable for plan in plans for syllable in plan.syllables})

    print(f"Missing direct word recordings: {len(plans) + len(unresolved)}", flush=True)
    print(f"Resolvable from audio-cmn syllables: {len(plans)}", flush=True)
    print(f"Unresolved: {len(unresolved)}", flush=True)
    print(f"Unique syllables needed: {len(needed_syllables)}", flush=True)

    if args.dry_run:
        return 1 if unresolved else 0

    download_errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(download_syllable, args.cache_dir, syllable) for syllable in needed_syllables]
        for future in concurrent.futures.as_completed(futures):
            syllable, error = future.result()
            if error:
                download_errors.append({"syllable": syllable, "error": error})

    if download_errors:
        for error in download_errors[:20]:
            print(f"syllable download error: {error['syllable']} {error['error']}", file=sys.stderr)
        print(f"Failed to download {len(download_errors)} syllables.", file=sys.stderr)
        return 1

    results: list[dict[str, object]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(generate_word_audio, plan, args.force) for plan in plans]
        total = len(futures)
        for done, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            result = future.result()
            results.append(result)
            print_progress(done, total, result)

    update_manifests(args.manifest, args.generated_manifest, manifest, plans, results, unresolved)
    errors = [result for result in results if result.get("status") == "error"]
    print(f"Wrote updated manifest to {args.manifest}", flush=True)
    print(f"Wrote generated manifest to {args.generated_manifest}", flush=True)
    print(f"Generated/existing: {len(results) - len(errors)}; errors: {len(errors)}; unresolved: {len(unresolved)}", flush=True)
    return 1 if errors or unresolved else 0


if __name__ == "__main__":
    sys.exit(main())
