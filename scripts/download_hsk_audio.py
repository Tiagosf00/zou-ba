#!/usr/bin/env python3
"""Download HSK word audio from the CC-BY-SA audio-cmn corpus.

The Dong Chinese dictionary credits audio-cmn for many word recordings, but its
site terms are restrictive for bulk copying. This script uses the open GitHub
corpus directly and records any HSK words that are not present there so another
licensed fallback can be chosen later.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "assets" / "hsk.json"
DEFAULT_OUTPUT_DIR = ROOT / "assets" / "audio" / "hsk"
DEFAULT_MANIFEST = ROOT / "assets" / "audio" / "hsk_audio_manifest.json"
DEFAULT_MISSING = ROOT / "assets" / "audio" / "hsk_audio_direct_missing.txt"
DEFAULT_CACHE_DIR = Path("/tmp") / "zou-ba-audio-cmn"

REPO_OWNER = "hugolpz"
REPO_NAME = "audio-cmn"
REPO_REF = "master"
REPO_URL = f"https://github.com/{REPO_OWNER}/{REPO_NAME}.git"
TREE_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/git/trees/{REPO_REF}?recursive=1"
RAW_BASE_URL = f"https://raw.githubusercontent.com/{REPO_OWNER}/{REPO_NAME}/{REPO_REF}"
QUALITIES = ("96k", "64k", "24k-abr", "18k-abr")
METHODS = ("curl", "git", "raw")
USER_AGENT = "zou-ba-hsk-audio-downloader/1.0 (+https://github.com/hugolpz/audio-cmn)"


@dataclass(frozen=True)
class WordRecord:
    hanzi: str
    levels: tuple[int, ...]
    entry_ids: tuple[int, ...]
    pinyin: str | None


@dataclass(frozen=True)
class DownloadTask:
    word: WordRecord
    repo_path: str
    source_url: str
    output_path: Path
    local_path: Path | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download available HSK word MP3 files from hugolpz/audio-cmn."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="HSK JSON dataset to read.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory for downloaded MP3 files.",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help="JSON manifest path to write.",
    )
    parser.add_argument(
        "--missing",
        type=Path,
        default=DEFAULT_MISSING,
        help="Text file path for words not found in audio-cmn.",
    )
    parser.add_argument(
        "--quality",
        choices=QUALITIES,
        default="64k",
        help="audio-cmn quality folder to use.",
    )
    parser.add_argument(
        "--method",
        choices=METHODS,
        default="curl",
        help="Use curl, a sparse Git checkout cache, or Python raw GitHub downloads.",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=DEFAULT_CACHE_DIR,
        help="Sparse Git checkout location used by --method git.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="Parallel download workers. Keep this modest for GitHub raw.",
    )
    parser.add_argument("--limit", type=int, help="Download at most this many available words.")
    parser.add_argument("--force", action="store_true", help="Re-download existing MP3 files.")
    parser.add_argument("--dry-run", action="store_true", help="Only compute coverage and write no files.")
    return parser.parse_args()


def request_url(url: str, timeout: int = 60) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            "Connection": "close",
        },
    )


def load_hsk_words(input_path: Path) -> list[WordRecord]:
    entries = json.loads(input_path.read_text(encoding="utf-8"))
    grouped: dict[str, dict[str, object]] = {}

    for entry in entries:
        hanzi = str(entry.get("hanzi", "")).strip()
        if not hanzi:
            continue

        bucket = grouped.setdefault(hanzi, {"levels": set(), "entry_ids": [], "pinyin": None})
        level = entry.get("level")
        if isinstance(level, int):
            bucket["levels"].add(level)
        entry_id = entry.get("id")
        if isinstance(entry_id, int):
            bucket["entry_ids"].append(entry_id)
        if bucket["pinyin"] is None and entry.get("pinyin"):
            bucket["pinyin"] = str(entry["pinyin"])

    return [
        WordRecord(
            hanzi=hanzi,
            levels=tuple(sorted(values["levels"])),
            entry_ids=tuple(values["entry_ids"]),
            pinyin=values["pinyin"],
        )
        for hanzi, values in sorted(grouped.items())
    ]


def fetch_tree_json_with_curl() -> dict[str, object]:
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
            TREE_URL,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def fetch_repo_paths(attempts: int = 4) -> set[str]:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            tree = fetch_tree_json_with_curl()
            break
        except (OSError, json.JSONDecodeError, subprocess.CalledProcessError) as error:
            last_error = error
            if attempt < attempts:
                print(f"GitHub tree fetch failed on attempt {attempt}; retrying...", flush=True)
                time.sleep(1.5 * attempt)
    else:
        raise RuntimeError(f"Could not fetch GitHub repository tree: {last_error}") from last_error

    if tree.get("truncated"):
        raise RuntimeError("GitHub returned a truncated repository tree; cannot trust coverage.")

    return {
        item["path"]
        for item in tree.get("tree", [])
        if isinstance(item, dict) and isinstance(item.get("path"), str)
    }


def run_git(args: list[str], cwd: Path | None = None) -> None:
    subprocess.run(["git", "-c", "http.version=HTTP/1.1", *args], cwd=cwd, check=True)


def ensure_git_checkout(cache_dir: Path, quality: str) -> Path:
    if cache_dir.exists() and not (cache_dir / ".git").exists():
        raise RuntimeError(f"{cache_dir} exists but is not a Git checkout")

    if not cache_dir.exists():
        cache_dir.parent.mkdir(parents=True, exist_ok=True)
        print(f"Cloning {REPO_URL} into {cache_dir}", flush=True)
        run_git(["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", REPO_URL, str(cache_dir)])

    run_git(["sparse-checkout", "init", "--cone"], cwd=cache_dir)
    run_git(["sparse-checkout", "set", f"{quality}/hsk"], cwd=cache_dir)
    run_git(["checkout", REPO_REF], cwd=cache_dir)
    return cache_dir


def fetch_repo_paths_from_checkout(checkout_dir: Path, quality: str) -> set[str]:
    quality_dir = checkout_dir / quality / "hsk"
    if not quality_dir.exists():
        raise RuntimeError(f"Expected audio directory does not exist: {quality_dir}")

    return {
        str(path.relative_to(checkout_dir))
        for path in quality_dir.glob("*.mp3")
        if path.is_file()
    }


def raw_url_for_path(repo_path: str) -> str:
    return f"{RAW_BASE_URL}/{urllib.parse.quote(repo_path)}"


def build_tasks(
    words: Iterable[WordRecord],
    repo_paths: set[str],
    quality: str,
    output_dir: Path,
    checkout_dir: Path | None = None,
) -> tuple[list[DownloadTask], list[WordRecord]]:
    tasks: list[DownloadTask] = []
    missing: list[WordRecord] = []

    for word in words:
        repo_path = f"{quality}/hsk/cmn-{word.hanzi}.mp3"
        if repo_path in repo_paths:
            tasks.append(
                DownloadTask(
                    word=word,
                    repo_path=repo_path,
                    source_url=raw_url_for_path(repo_path),
                    output_path=output_dir / f"cmn-{word.hanzi}.mp3",
                    local_path=checkout_dir / repo_path if checkout_dir else None,
                )
            )
        else:
            missing.append(word)

    return tasks, missing


def looks_like_mp3(data: bytes, content_type: str | None) -> bool:
    normalized_type = (content_type or "").lower()
    if "audio/" in normalized_type or "application/octet-stream" in normalized_type:
        return True
    return data.startswith(b"ID3") or data.startswith(b"\xff\xfb") or data.startswith(b"\xff\xf3")


def download_one(task: DownloadTask, force: bool, attempts: int = 3) -> dict[str, object]:
    task.output_path.parent.mkdir(parents=True, exist_ok=True)
    if task.output_path.exists() and not force and task.output_path.stat().st_size > 0:
        return {
            "hanzi": task.word.hanzi,
            "status": "exists",
            "bytes": task.output_path.stat().st_size,
            "file": str(task.output_path),
            "sourceUrl": task.source_url,
        }

    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request_url(task.source_url), timeout=45) as response:
                data = response.read()
                content_type = response.headers.get("Content-Type")

            if not data:
                raise RuntimeError("empty response")
            if not looks_like_mp3(data, content_type):
                raise RuntimeError(f"unexpected content type {content_type!r}")

            temp_path = task.output_path.with_suffix(task.output_path.suffix + ".part")
            temp_path.write_bytes(data)
            temp_path.replace(task.output_path)
            return {
                "hanzi": task.word.hanzi,
                "status": "downloaded",
                "bytes": len(data),
                "file": str(task.output_path),
                "sourceUrl": task.source_url,
            }
        except (OSError, RuntimeError, urllib.error.URLError, urllib.error.HTTPError) as error:
            last_error = error
            if attempt < attempts:
                time.sleep(0.6 * attempt)

    return {
        "hanzi": task.word.hanzi,
        "status": "error",
        "error": str(last_error),
        "file": str(task.output_path),
        "sourceUrl": task.source_url,
    }


def curl_one(task: DownloadTask, force: bool) -> dict[str, object]:
    task.output_path.parent.mkdir(parents=True, exist_ok=True)
    if task.output_path.exists() and not force and task.output_path.stat().st_size > 0:
        return {
            "hanzi": task.word.hanzi,
            "status": "exists",
            "bytes": task.output_path.stat().st_size,
            "file": str(task.output_path),
            "sourceUrl": task.source_url,
        }

    temp_path = task.output_path.with_suffix(task.output_path.suffix + ".part")
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
                "25",
                "--retry",
                "2",
                "--retry-delay",
                "1",
                "--retry-connrefused",
                "--user-agent",
                USER_AGENT,
                "--output",
                str(temp_path),
                task.source_url,
            ],
            check=True,
            capture_output=True,
            text=True,
        )

        data = temp_path.read_bytes()
        if not data:
            raise RuntimeError("empty response")
        if not looks_like_mp3(data[:16], "audio/mpeg"):
            raise RuntimeError("download does not look like MP3 data")

        temp_path.replace(task.output_path)
        return {
            "hanzi": task.word.hanzi,
            "status": "downloaded",
            "bytes": task.output_path.stat().st_size,
            "file": str(task.output_path),
            "sourceUrl": task.source_url,
        }
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        if temp_path.exists():
            temp_path.unlink()
        if isinstance(error, subprocess.CalledProcessError):
            error_text = (error.stderr or error.stdout or str(error)).strip()
        else:
            error_text = str(error)
        return {
            "hanzi": task.word.hanzi,
            "status": "error",
            "error": error_text,
            "file": str(task.output_path),
            "sourceUrl": task.source_url,
        }


def copy_one(task: DownloadTask, force: bool) -> dict[str, object]:
    task.output_path.parent.mkdir(parents=True, exist_ok=True)
    if task.output_path.exists() and not force and task.output_path.stat().st_size > 0:
        return {
            "hanzi": task.word.hanzi,
            "status": "exists",
            "bytes": task.output_path.stat().st_size,
            "file": str(task.output_path),
            "sourceUrl": task.source_url,
        }

    if task.local_path is None:
        return {
            "hanzi": task.word.hanzi,
            "status": "error",
            "error": "missing local source path",
            "file": str(task.output_path),
            "sourceUrl": task.source_url,
        }

    try:
        data = task.local_path.read_bytes()
        if not data:
            raise RuntimeError("empty source file")
        if not looks_like_mp3(data[:16], "audio/mpeg"):
            raise RuntimeError("source does not look like MP3 data")

        temp_path = task.output_path.with_suffix(task.output_path.suffix + ".part")
        shutil.copy2(task.local_path, temp_path)
        temp_path.replace(task.output_path)
        return {
            "hanzi": task.word.hanzi,
            "status": "copied",
            "bytes": task.output_path.stat().st_size,
            "file": str(task.output_path),
            "sourceUrl": task.source_url,
        }
    except (OSError, RuntimeError) as error:
        return {
            "hanzi": task.word.hanzi,
            "status": "error",
            "error": str(error),
            "file": str(task.output_path),
            "sourceUrl": task.source_url,
        }


def write_manifest(
    manifest_path: Path,
    missing_path: Path,
    words: list[WordRecord],
    tasks: list[DownloadTask],
    missing: list[WordRecord],
    results: list[dict[str, object]],
    quality: str,
) -> None:
    result_by_hanzi = {str(result["hanzi"]): result for result in results}
    task_by_hanzi = {task.word.hanzi: task for task in tasks}
    missing_hanzi = {word.hanzi for word in missing}

    items = []
    for word in words:
        task = task_by_hanzi.get(word.hanzi)
        result = result_by_hanzi.get(word.hanzi)
        item = {
            "hanzi": word.hanzi,
            "pinyin": word.pinyin,
            "levels": list(word.levels),
            "entryIds": list(word.entry_ids),
        }

        if result and result.get("status") != "error":
            item.update(
                {
                    "status": result["status"],
                    "file": result["file"],
                    "source": "audio-cmn",
                    "sourceUrl": result["sourceUrl"],
                    "bytes": result["bytes"],
                    "license": "CC-BY-SA",
                }
            )
        elif result and result.get("status") == "error":
            item.update(
                {
                    "status": "error",
                    "source": "audio-cmn",
                    "sourceUrl": result["sourceUrl"],
                    "error": result["error"],
                }
            )
        elif word.hanzi in missing_hanzi:
            item.update({"status": "missing", "source": None, "reason": "not found in audio-cmn"})
        elif task:
            item.update(
                {
                    "status": "pending",
                    "source": "audio-cmn",
                    "sourceUrl": task.source_url,
                }
            )

        items.append(item)

    downloaded = sum(1 for item in items if item.get("status") in {"downloaded", "exists"})
    errors = sum(1 for item in items if item.get("status") == "error")
    manifest = {
        "source": "hugolpz/audio-cmn",
        "sourceRepository": f"https://github.com/{REPO_OWNER}/{REPO_NAME}",
        "quality": quality,
        "license": "CC-BY-SA; see upstream README for speaker/source attribution",
        "totalUniqueWords": len(words),
        "availableInAudioCmn": len(tasks),
        "downloadedOrExisting": downloaded,
        "missing": len(missing),
        "errors": errors,
        "items": items,
    }

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    missing_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    missing_path.write_text("\n".join(word.hanzi for word in missing) + ("\n" if missing else ""), encoding="utf-8")


def print_progress(done: int, total: int, result: dict[str, object]) -> None:
    if done == total or done % 100 == 0 or result.get("status") == "error":
        status = result.get("status")
        hanzi = result.get("hanzi")
        print(f"[{done}/{total}] {status}: {hanzi}", flush=True)


def main() -> int:
    args = parse_args()
    if args.workers < 1:
        raise SystemExit("--workers must be at least 1")

    words = load_hsk_words(args.input)
    print(f"Loaded {len(words)} unique words from {args.input}", flush=True)

    checkout_dir = None
    if args.method == "git":
        checkout_dir = ensure_git_checkout(args.cache_dir, args.quality)
        repo_paths = fetch_repo_paths_from_checkout(checkout_dir, args.quality)
    else:
        repo_paths = fetch_repo_paths()

    tasks, missing = build_tasks(words, repo_paths, args.quality, args.output_dir, checkout_dir)
    if args.limit is not None:
        tasks = tasks[: args.limit]

    print(f"{len(tasks)} words available in audio-cmn {args.quality}; {len(missing)} missing.", flush=True)
    if args.dry_run:
        print("Dry run complete; no files written.", flush=True)
        return 0

    results: list[dict[str, object]] = []
    if args.method == "git":
        worker = copy_one
    elif args.method == "curl":
        worker = curl_one
    else:
        worker = download_one
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        future_to_task = {executor.submit(worker, task, args.force): task for task in tasks}
        total = len(future_to_task)
        for done, future in enumerate(concurrent.futures.as_completed(future_to_task), start=1):
            result = future.result()
            results.append(result)
            print_progress(done, total, result)

    write_manifest(args.manifest, args.missing, words, tasks, missing, results, args.quality)
    errors = [result for result in results if result.get("status") == "error"]
    print(f"Wrote manifest to {args.manifest}", flush=True)
    print(f"Wrote missing list to {args.missing}", flush=True)
    print(f"Downloaded/existing: {len(results) - len(errors)}; errors: {len(errors)}; missing: {len(missing)}", flush=True)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
