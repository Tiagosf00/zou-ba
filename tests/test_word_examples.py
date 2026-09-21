import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_word_examples import build_examples, reading_key


class WordExamplesTest(unittest.TestCase):
    def test_tones_are_preserved_but_anki_entities_and_spacing_are_normalized(self):
        self.assertEqual(reading_key('nǚ&#x27;ér'), reading_key('nǚ ér'))
        self.assertNotEqual(reading_key('cháng'), reading_key('zhǎng'))
        self.assertNotEqual(reading_key('lǜ'), reading_key('lù'))

    def test_same_sound_different_meanings_do_not_mix(self):
        words = [dict(id=1, level=2, hanzi='花', pinyin='huā', rawEnglish='spend'),
                 dict(id=2, level=2, hanzi='花', pinyin='huā', rawEnglish='flower')]
        sentences = [dict(id='s1', chinese='我花了十块钱。', pinyin='example', translation='spent')]
        records = [dict(level=2, focusWord='花', focusPinyin='huā',
                        focusMeaning='to spend (money or time)',
                        chinese=sentences[0]['chinese'], pinyin='example', translation='spent')]
        result = build_examples(words, sentences, records)
        self.assertEqual(result['entries']['1']['sentenceIds'], ['s1'])
        self.assertNotIn('2', result['entries'])

    def test_other_readings_and_levels_are_not_attached(self):
        words = [dict(id=1, level=1, hanzi='长', pinyin='zhǎng', rawEnglish='grow')]
        sentences = [dict(id='s1', chinese='路很长。', pinyin='example', translation='long')]
        records = [dict(level=1, focusWord='长', focusPinyin='cháng', focusMeaning='long',
                        chinese='路很长。', pinyin='example', translation='long')]
        self.assertEqual(build_examples(words, sentences, records)['entries'], {})
        records[0].update(focusPinyin='zhǎng', level=2)
        self.assertEqual(build_examples(words, sentences, records)['entries'], {})


if __name__ == '__main__':
    unittest.main()
