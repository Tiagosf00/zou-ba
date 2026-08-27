#!/usr/bin/env python3
"""Build the HSK Standard Course textbook-audio catalog from BLCUP indexes."""

from __future__ import annotations

import argparse
import json
import re
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "assets" / "hsk_standard_course_audio.json"
BLCUP_BASE_URL = "https://www.blcup.com"
RESOURCE_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
TRACK_CODE_PATTERN = re.compile(
    r"(?:^|\s)(\d{2})(?:-(\d+))?(?:\s*\((\d+)\))?(?=\D*$)"
)

BOOKS = [
    {
        "bookId": "hsk1",
        "label": "HSK 1",
        "seriesId": "c55419ff-dd4c-4ead-9dae-0d159197f622",
        "expectedTracks": 86,
    },
    {
        "bookId": "hsk2",
        "label": "HSK 2",
        "seriesId": "d47a93c3-ae70-43f6-9e32-140b2a473d53",
        "expectedTracks": 76,
    },
    {
        "bookId": "hsk3",
        "label": "HSK 3",
        "seriesId": "1cd84d66-f817-40a4-bfaf-2d58b02ebe3a",
        "expectedTracks": 101,
    },
    {
        "bookId": "hsk4a",
        "label": "HSK 4上",
        "seriesId": "009861d5-008b-495d-ae7a-23482ec05ad7",
        "expectedTracks": 52,
    },
    {
        "bookId": "hsk4b",
        "label": "HSK 4下",
        "seriesId": "3ddee33f-4951-4075-8698-18b1ef0190e0",
        "expectedTracks": 51,
    },
    {
        "bookId": "hsk5a",
        "label": "HSK 5上",
        "seriesId": "f1a99c5e-b11a-418e-8931-225d65a9eecf",
        "expectedTracks": 39,
    },
    {
        "bookId": "hsk5b",
        "label": "HSK 5下",
        "seriesId": "e26ee8ac-f5b4-46c2-a559-878a7bf9d8b5",
        "expectedTracks": 37,
    },
    {
        "bookId": "hsk6a",
        "label": "HSK 6上",
        "seriesId": "9c4d9b7f-5cf5-4f5c-bc29-7b4b89feaec1",
        "expectedTracks": 42,
    },
    {
        "bookId": "hsk6b",
        "label": "HSK 6下",
        "seriesId": "bc301459-7c99-47d1-90ea-6ccdfaf6ee06",
        "expectedTracks": 41,
    },
]
EXPECTED_TOTAL = sum(book["expectedTracks"] for book in BOOKS)


class MobileResourceParser(HTMLParser):
    """Extract MobileResource links and their visible titles in document order."""

    def __init__(self) -> None:
        super().__init__()
        self._active_href: str | None = None
        self._active_text: list[str] = []
        self._badge_depth = 0
        self.resources: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "a" and "/MobileResource?" in str(attributes.get("href") or ""):
            self._active_href = str(attributes["href"])
            self._active_text = []
            self._badge_depth = 0
        elif self._active_href and tag == "span":
            self._badge_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if not self._active_href:
            return

        if tag == "span" and self._badge_depth:
            self._badge_depth -= 1
        elif tag == "a":
            title = " ".join("".join(self._active_text).split())
            self.resources.append((self._active_href, title))
            self._active_href = None
            self._active_text = []
            self._badge_depth = 0

    def handle_data(self, data: str) -> None:
        if self._active_href and self._badge_depth == 0:
            self._active_text.append(data)


def parse_track_code(title: str) -> tuple[str | None, int | None]:
    match = TRACK_CODE_PATTERN.search(title)
    if not match:
        return None, None

    code = match.group(1)
    if match.group(2):
        code += f"-{match.group(2)}"
    if match.group(3):
        code += f" ({match.group(3)})"

    lesson_number = int(match.group(1)) if match.group(1) != "00" else None
    return code, lesson_number


def parse_series_html(html: str) -> list[dict[str, object]]:
    parser = MobileResourceParser()
    parser.feed(html)
    tracks: list[dict[str, object]] = []

    for order, (href, title) in enumerate(parser.resources):
        resource_id = parse_qs(urlparse(href).query).get("rid", [""])[0]
        code, lesson_number = parse_track_code(title)
        tracks.append(
            {
                "resourceId": resource_id,
                "code": code,
                "lessonNumber": lesson_number,
                "title": title,
                "order": order,
            }
        )

    return tracks


def fetch_series_html(series_id: str) -> tuple[str, str]:
    series_url = f"{BLCUP_BASE_URL}/MobileResSeries?rid={series_id}"
    request = Request(
        series_url,
        headers={"User-Agent": "zou-ba HSK audio catalog builder/1.0"},
    )
    with urlopen(request, timeout=30) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return series_url, response.read().decode(charset, errors="replace")


def validate_catalog(catalog: dict[str, object]) -> None:
    books = catalog.get("books")
    if not isinstance(books, list) or len(books) != len(BOOKS):
        raise ValueError(f"Expected {len(BOOKS)} books, found {len(books or [])}")

    expected_by_id = {book["bookId"]: book for book in BOOKS}
    resource_ids: set[str] = set()
    total_tracks = 0

    for book in books:
        if not isinstance(book, dict) or book.get("bookId") not in expected_by_id:
            raise ValueError(f"Unexpected book entry: {book!r}")

        expected = expected_by_id[str(book["bookId"])]
        tracks = book.get("tracks")
        if not isinstance(tracks, list):
            raise ValueError(f"{book['bookId']} tracks must be a list")
        if len(tracks) != expected["expectedTracks"]:
            raise ValueError(
                f"{book['bookId']} expected {expected['expectedTracks']} tracks, "
                f"found {len(tracks)}"
            )

        source_url = str(book.get("seriesUrl") or "")
        if source_url != urljoin(BLCUP_BASE_URL, f"/MobileResSeries?rid={expected['seriesId']}"):
            raise ValueError(f"Unexpected series URL for {book['bookId']}: {source_url}")

        for order, track in enumerate(tracks):
            resource_id = str(track.get("resourceId") or "")
            if not RESOURCE_ID_PATTERN.fullmatch(resource_id):
                raise ValueError(f"Invalid resource id in {book['bookId']}: {resource_id}")
            if resource_id in resource_ids:
                raise ValueError(f"Duplicate resource id: {resource_id}")
            if track.get("order") != order:
                raise ValueError(f"Non-sequential order in {book['bookId']} at {order}")
            if not str(track.get("title") or "").strip():
                raise ValueError(f"Missing title in {book['bookId']} at {order}")
            resource_ids.add(resource_id)

        total_tracks += len(tracks)

    if total_tracks != EXPECTED_TOTAL or catalog.get("totalTracks") != EXPECTED_TOTAL:
        raise ValueError(
            f"Expected {EXPECTED_TOTAL} total tracks, found {total_tracks} "
            f"(manifest says {catalog.get('totalTracks')})"
        )


def build_catalog() -> dict[str, object]:
    books: list[dict[str, object]] = []

    with ThreadPoolExecutor(max_workers=4) as executor:
        series_pages = list(
            executor.map(
                fetch_series_html,
                [str(book["seriesId"]) for book in BOOKS],
            )
        )

    for book, (series_url, html) in zip(BOOKS, series_pages):
        tracks = parse_series_html(html)
        books.append(
            {
                "bookId": book["bookId"],
                "label": book["label"],
                "seriesUrl": series_url,
                "trackCount": len(tracks),
                "tracks": tracks,
            }
        )

    catalog = {
        "source": "Beijing Language and Culture University Press",
        "sourceBaseUrl": BLCUP_BASE_URL,
        "totalTracks": sum(len(book["tracks"]) for book in books),
        "books": books,
    }
    validate_catalog(catalog)
    return catalog


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the official HSK Standard Course audio catalog."
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate the committed manifest without fetching BLCUP.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.validate_only:
        catalog = json.loads(args.output.read_text(encoding="utf-8"))
        validate_catalog(catalog)
        print(f"Validated {catalog['totalTracks']} tracks in {args.output}")
        return 0

    catalog = build_catalog()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {catalog['totalTracks']} tracks to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
