import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_hsk_course_audio_catalog import (  # noqa: E402
    EXPECTED_TOTAL,
    parse_series_html,
    parse_track_code,
    validate_catalog,
)


class HskCourseAudioCatalogTest(unittest.TestCase):
    def test_parses_tracks_in_source_order_and_ignores_badges(self):
        html = """
        <a href="/MobileResource?rid=11111111-1111-1111-1111-111111111111">
            HSK标准教程3 课本音频 00片头<span>mp3</span>
        </a>
        <a href="/MobileResource?rid=22222222-2222-2222-2222-222222222222">
            HSK标准教程3 课本音频 20-5 (1)<span>mp3</span>
        </a>
        <a href="/MobileResource?rid=33333333-3333-3333-3333-333333333333">
            HSK标准教程4上 音频<span>mp3</span>
        </a>
        """

        self.assertEqual(
            parse_series_html(html),
            [
                {
                    "resourceId": "11111111-1111-1111-1111-111111111111",
                    "code": "00",
                    "lessonNumber": None,
                    "title": "HSK标准教程3 课本音频 00片头",
                    "order": 0,
                },
                {
                    "resourceId": "22222222-2222-2222-2222-222222222222",
                    "code": "20-5 (1)",
                    "lessonNumber": 20,
                    "title": "HSK标准教程3 课本音频 20-5 (1)",
                    "order": 1,
                },
                {
                    "resourceId": "33333333-3333-3333-3333-333333333333",
                    "code": None,
                    "lessonNumber": None,
                    "title": "HSK标准教程4上 音频",
                    "order": 2,
                },
            ],
        )

    def test_parses_intro_split_and_regular_codes(self):
        self.assertEqual(parse_track_code("Textbook audio 00"), ("00", None))
        self.assertEqual(parse_track_code("Textbook audio 20-5 (3)"), ("20-5 (3)", 20))
        self.assertEqual(parse_track_code("Textbook audio 06-2"), ("06-2", 6))
        self.assertEqual(parse_track_code("Textbook audio"), (None, None))

    def test_committed_manifest_is_valid(self):
        catalog_path = ROOT / "assets" / "hsk_standard_course_audio.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        validate_catalog(catalog)
        self.assertEqual(catalog["totalTracks"], EXPECTED_TOTAL)


if __name__ == "__main__":
    unittest.main()
