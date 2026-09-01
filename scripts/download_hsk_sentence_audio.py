#!/usr/bin/env python3
"""Download the higher-level Anki packages and rebuild the local listening corpus."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = PROJECT_ROOT / "scripts" / "build_hsk_sentence_deck.py"
RELEASE_BASE = (
    "https://github.com/NewHSK3/new-hsk-3-anki-deck/releases/download/v1.0"
)
PACKAGES = {
    "New.HSK.3.0__HSK.5.apkg": (
        f"{RELEASE_BASE}/New.HSK.3.0__HSK.5.apkg",
        242_637_450,
    ),
    "New.HSK.3.0__HSK.6.apkg": (
        f"{RELEASE_BASE}/New.HSK.3.0__HSK.6.apkg",
        309_175_511,
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the HSK 1-6 listening corpus from the author's Anki packages."
    )
    parser.add_argument(
        "--hsk1-4",
        required=True,
        type=Path,
        help="Path to the HSK 1-4 .apkg downloaded from AnkiWeb.",
    )
    parser.add_argument(
        "--download-dir",
        type=Path,
        default=Path(tempfile.gettempdir()) / "zou-ba-new-hsk-source",
        help="Directory used for the resumable HSK 5 and HSK 6 downloads.",
    )
    return parser.parse_args()


def download(url: str, destination: Path, expected_size: int) -> None:
    if destination.exists() and destination.stat().st_size == expected_size:
        print(f"Ready: {destination.name}")
        return

    partial = destination.with_suffix(destination.suffix + ".part")
    downloaded = partial.stat().st_size if partial.exists() else 0
    headers = {"User-Agent": "zou-ba-new-hsk-downloader/1.0"}
    if downloaded:
        headers["Range"] = f"bytes={downloaded}-"
    request = Request(url, headers=headers)

    with urlopen(request, timeout=90) as response:
        if downloaded and response.status != 206:
            downloaded = 0
            partial.unlink(missing_ok=True)
        mode = "ab" if downloaded else "wb"
        with partial.open(mode) as output:
            shutil.copyfileobj(response, output, length=1024 * 1024)

    actual_size = partial.stat().st_size
    if actual_size != expected_size:
        raise ValueError(
            f"Unexpected size for {destination.name}: {actual_size:,}; "
            f"expected {expected_size:,}."
        )
    partial.replace(destination)
    print(f"Downloaded: {destination.name} ({actual_size / 1024 / 1024:.1f} MiB)")


def main() -> None:
    args = parse_args()
    hsk1_4 = args.hsk1_4.expanduser().resolve()
    if not hsk1_4.is_file():
        raise FileNotFoundError(f"HSK 1-4 package not found: {hsk1_4}")

    download_dir = args.download_dir.expanduser().resolve()
    download_dir.mkdir(parents=True, exist_ok=True)
    package_paths = [hsk1_4]
    for filename, (url, expected_size) in PACKAGES.items():
        destination = download_dir / filename
        download(url, destination, expected_size)
        package_paths.append(destination)

    subprocess.run(
        [sys.executable, str(BUILD_SCRIPT), *(str(path) for path in package_paths)],
        cwd=PROJECT_ROOT,
        check=True,
    )


if __name__ == "__main__":
    main()
