import unittest
from pathlib import Path

from pinyin_helpers import count_hanzi_syllables, load_valid_syllables, normalize_pinyin


ROOT = Path(__file__).resolve().parents[1]
VALID_SYLLABLES = load_valid_syllables(ROOT / 'src' / 'data' / 'validPinyin.js')


class PinyinNormalizationTest(unittest.TestCase):
    def assertPinyin(self, raw_pinyin, expected_syllables, expected):
        self.assertEqual(
            normalize_pinyin(
                raw_pinyin,
                VALID_SYLLABLES,
                raw_pinyin,
                expected_syllables=expected_syllables,
            ),
            expected,
        )

    def test_keeps_common_compact_words_together(self):
        self.assertPinyin('nǐhǎo', 2, 'nǐ hǎo')
        self.assertPinyin('péngyou', 2, 'péng you')
        self.assertPinyin('duìbuqǐ', 3, 'duì bu qǐ')

    def test_avoids_vowel_initial_false_splits(self):
        self.assertPinyin('kěnéng', 2, 'kě néng')
        self.assertPinyin('bàngōngshì', 3, 'bàn gōng shì')
        self.assertPinyin('yángé', 2, 'yán gé')
        self.assertPinyin('fēngōng', 2, 'fēn gōng')
        self.assertPinyin('gāngà', 2, 'gān gà')
        self.assertPinyin('míngē', 2, 'mín gē')

    def test_handles_single_syllables_and_variants(self):
        self.assertPinyin('niǎo', 1, 'niǎo')
        self.assertPinyin('ángguì', 2, 'áng guì')
        self.assertPinyin('cèlüè', 2, 'cè lüè')
        self.assertPinyin('shéi/shuí', 1, 'shéi/shuí')

    def test_counts_hanzi_syllables(self):
        self.assertEqual(count_hanzi_syllables('可能'), 2)
        self.assertEqual(count_hanzi_syllables('好玩儿'), 3)
        self.assertEqual(count_hanzi_syllables('HSK'), 0)


if __name__ == '__main__':
    unittest.main()
