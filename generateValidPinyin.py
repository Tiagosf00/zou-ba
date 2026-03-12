import json
import sys
from pathlib import Path

from pinyin_helpers import MANUAL_VALID_SYLLABLES, to_plain_pinyin


ROOT = Path(__file__).resolve().parent
HSK_PATH = ROOT / 'assets' / 'hsk.json'
OUTPUT_PATH = ROOT / 'src' / 'data' / 'validPinyin.js'


def main():
    try:
        data = json.loads(HSK_PATH.read_text(encoding='utf-8'))
        unique_syllables = set()

        for item in data:
            for segment in item.get('pinyin', '').split():
                normalized = to_plain_pinyin(segment)
                if normalized:
                    unique_syllables.add(normalized)

        unique_syllables.update(MANUAL_VALID_SYLLABLES)
        sorted_syllables = sorted(unique_syllables)
        output = f"export const validSyllables = new Set({json.dumps(sorted_syllables, ensure_ascii=False, indent=2)});\n"
        OUTPUT_PATH.write_text(output, encoding='utf-8')
        print(f'Generated validPinyin.js with {len(sorted_syllables)} syllables.')
    except Exception as error:  # noqa: BLE001
        print(f'Error generating valid pinyin: {error}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
