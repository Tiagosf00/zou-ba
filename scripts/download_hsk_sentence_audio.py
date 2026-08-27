#!/usr/bin/env python3
"""Download the HSK sentence MP3 collection for local-first web playback."""

from __future__ import annotations

import json
import shutil
import threading
from pathlib import Path
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DECK_PATH = PROJECT_ROOT / "assets" / "hsk_sentences_audio.json"
OUTPUT_ROOT = PROJECT_ROOT / "public" / "audio" / "hsk-sentences"
REPO_ID = "no7z/hsk-sentences-audio"
RESOLVE_BASE = f"https://huggingface.co/datasets/{REPO_ID}/resolve"


def load_deck() -> tuple[dict, list[str]]:
    deck = json.loads(DECK_PATH.read_text(encoding="utf-8"))
    paths = sorted(
        {
            audio_path
            for sentence in deck["sentences"]
            for audio_path in (sentence["audioNormal"], sentence["audioSlow"])
        }
    )
    if len(paths) != deck["count"] * 2:
        raise ValueError(f"Expected {deck['count'] * 2} unique MP3 paths, found {len(paths)}.")
    if any(not path.startswith("audio/") or not path.endswith(".mp3") for path in paths):
        raise ValueError("The deck contains an unexpected audio path.")
    return deck, paths


def download_with_hugging_face_xet(expected_paths: list[str], revision: str) -> None:
    from hf_xet import PyXetDownloadInfo, download_files
    from huggingface_hub.utils import XetFileData, build_hf_headers
    from huggingface_hub.utils._pagination import paginate
    from huggingface_hub.utils._xet import refresh_xet_connection_info

    headers = build_hf_headers(library_name="zou-ba-audio-downloader")
    tree_url = f"https://huggingface.co/api/datasets/{REPO_ID}/tree/{revision}/audio"
    tree_items = list(
        paginate(
            tree_url,
            params={"recursive": "true", "expand": "false", "limit": 1000},
            headers=headers,
        )
    )
    metadata_by_path = {
        item["path"]: item
        for item in tree_items
        if item.get("type") == "file" and item.get("path", "").endswith(".mp3")
    }
    if set(metadata_by_path) != set(expected_paths):
        raise ValueError("Hugging Face audio metadata does not match the local sentence deck.")

    audio_directory = OUTPUT_ROOT / "audio"
    audio_directory.mkdir(parents=True, exist_ok=True)
    existing_sizes = {
        f"audio/{path.name}": path.stat().st_size for path in audio_directory.glob("*.mp3")
    }
    download_infos = []
    remaining_bytes = 0
    for audio_path in expected_paths:
        metadata = metadata_by_path[audio_path]
        destination = OUTPUT_ROOT / audio_path
        expected_size = metadata["size"]
        if existing_sizes.get(audio_path) == expected_size:
            continue
        download_infos.append(
            PyXetDownloadInfo(str(destination.absolute()), metadata["xetHash"], expected_size)
        )
        remaining_bytes += expected_size

    if not download_infos:
        return

    refresh_route = (
        f"https://huggingface.co/api/datasets/{REPO_ID}/xet-read-token/{revision}"
    )
    file_data = XetFileData(download_infos[0].hash, refresh_route)
    connection_info = refresh_xet_connection_info(file_data=file_data, headers=headers)

    def token_refresher() -> tuple[str, int]:
        refreshed_info = refresh_xet_connection_info(file_data=file_data, headers=headers)
        return refreshed_info.access_token, refreshed_info.expiration_unix_epoch

    progress_lock = threading.Lock()
    progress_bytes = 0
    next_report = 16 * 1024 * 1024

    def progress_updater(increment: int) -> None:
        nonlocal progress_bytes, next_report
        with progress_lock:
            progress_bytes += increment
            if progress_bytes >= next_report or progress_bytes >= remaining_bytes:
                print(
                    f"Downloaded {progress_bytes / 1024 / 1024:.1f} / "
                    f"{remaining_bytes / 1024 / 1024:.1f} MiB",
                    flush=True,
                )
                next_report += 16 * 1024 * 1024

    download_files(
        download_infos,
        endpoint=connection_info.endpoint,
        token_info=(connection_info.access_token, connection_info.expiration_unix_epoch),
        token_refresher=token_refresher,
        progress_updater=[progress_updater] * len(download_infos),
    )


def download_one(audio_path: str, revision: str) -> None:
    destination = OUTPUT_ROOT / audio_path
    if destination.exists() and destination.stat().st_size > 512:
        return

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = destination.with_suffix(".mp3.part")
    request = Request(
        f"{RESOLVE_BASE}/{revision}/{audio_path}",
        headers={"User-Agent": "zou-ba-audio-downloader/1.0"},
    )
    with urlopen(request, timeout=90) as response, temporary_path.open("wb") as output:
        shutil.copyfileobj(response, output)
    if temporary_path.stat().st_size <= 512:
        temporary_path.unlink(missing_ok=True)
        raise ValueError(f"Downloaded audio is unexpectedly small: {audio_path}")
    temporary_path.replace(destination)


def download_with_standard_library(paths: list[str], revision: str) -> None:
    from concurrent.futures import ThreadPoolExecutor

    print("huggingface_hub is unavailable; using the slower direct downloader.")
    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(lambda path: download_one(path, revision), paths))


def main() -> None:
    deck, expected_paths = load_deck()
    revision = deck.get("sourceRevision") or "main"
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    for partial_path in OUTPUT_ROOT.rglob("*.part"):
        partial_path.unlink(missing_ok=True)

    audio_directory = OUTPUT_ROOT / "audio"
    local_collection_is_complete = (
        audio_directory.exists()
        and sum(1 for _ in audio_directory.glob("*.mp3")) == len(expected_paths)
    )
    if not local_collection_is_complete:
        try:
            download_with_hugging_face_xet(expected_paths, revision)
        except ImportError:
            download_with_standard_library(expected_paths, revision)

    cache_directory = OUTPUT_ROOT / ".cache"
    if cache_directory.exists():
        shutil.rmtree(cache_directory)

    downloaded_paths = sorted(
        path.relative_to(OUTPUT_ROOT).as_posix()
        for path in (OUTPUT_ROOT / "audio").glob("*.mp3")
    )
    missing_paths = sorted(set(expected_paths) - set(downloaded_paths))
    unexpected_paths = sorted(set(downloaded_paths) - set(expected_paths))
    if missing_paths or unexpected_paths:
        raise ValueError(
            "Download incomplete: "
            f"{len(missing_paths)} MP3s are missing and "
            f"{len(unexpected_paths)} are unexpected."
        )

    total_bytes = sum((OUTPUT_ROOT / path).stat().st_size for path in expected_paths)
    manifest = {
        "source": deck["source"],
        "sourceRevision": revision,
        "license": deck["license"],
        "fileCount": len(expected_paths),
        "totalBytes": total_bytes,
    }
    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Ready: {len(expected_paths):,} MP3s ({total_bytes / 1024 / 1024:.1f} MiB)")


if __name__ == "__main__":
    main()
