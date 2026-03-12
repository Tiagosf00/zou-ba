import json
import sys
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

from pinyin_helpers import clean_cell_text, normalize_chinese, normalize_definitions, normalize_pinyin, load_valid_syllables


LEVELS = [1, 2, 3, 4, 5, 6]
EXPECTED_COUNTS = {
    1: 500,
    2: 772,
    3: 973,
    4: 1000,
    5: 1071,
    6: 1140,
}
ROOT = Path(__file__).resolve().parent
OUTPUT_FILE = ROOT / 'assets' / 'hsk.json'
VALID_PINYIN_PATH = ROOT / 'src' / 'data' / 'validPinyin.js'
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
PINYIN_OVERRIDES = {
    (5, 935): 'yuándàn',
    (6, 236): 'duānwǔjié',
}


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self._table_depth = 0
        self._current_table = None
        self._current_row = None
        self._current_cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            if self._table_depth == 0:
                self._current_table = []
            self._table_depth += 1
            return

        if self._table_depth == 0:
            return

        if tag == 'tr':
            self._current_row = []
        elif tag in {'td', 'th'} and self._current_row is not None:
            self._current_cell = []

    def handle_data(self, data):
        if self._current_cell is not None:
            self._current_cell.append(data)

    def handle_endtag(self, tag):
        if self._table_depth == 0:
            return

        if tag in {'td', 'th'} and self._current_cell is not None and self._current_row is not None:
            self._current_row.append(clean_cell_text(''.join(self._current_cell)))
            self._current_cell = None
            return

        if tag == 'tr' and self._current_row is not None:
            if any(cell for cell in self._current_row):
                self._current_table.append(self._current_row)
            self._current_row = None
            return

        if tag == 'table':
            self._table_depth -= 1
            if self._table_depth == 0 and self._current_table is not None:
                self.tables.append(self._current_table)
                self._current_table = None


def get_level_url(level):
    return f'https://mandarinbean.com/new-hsk-{level}-word-list/'


def fetch_html(url):
    request = urllib.request.Request(url, headers={
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    })
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read().decode('utf-8', errors='replace')


def find_vocabulary_table(level, tables):
    for table in tables:
        if not table:
            continue
        header = [clean_cell_text(cell).lower() for cell in table[0][:4]]
        if header == ['no', 'chinese', 'pinyin', 'english']:
            return table

    raise RuntimeError(f'Could not find the vocabulary table on HSK {level}')


def parse_level_page(level, html, starting_id, valid_syllables):
    parser = TableParser()
    parser.feed(html)
    table = find_vocabulary_table(level, parser.tables)
    entries = []

    for row in table[1:]:
        if len(row) < 4:
            continue

        try:
            source_row = int(clean_cell_text(row[0]))
        except ValueError:
            continue

        raw_chinese = clean_cell_text(row[1])
        raw_pinyin = clean_cell_text(row[2])
        raw_english = clean_cell_text(row[3])
        context = f'HSK {level} row {source_row}'
        hanzi = normalize_chinese(raw_chinese)
        normalized_source_pinyin = PINYIN_OVERRIDES.get((level, source_row), raw_pinyin)
        try:
            pinyin = normalize_pinyin(normalized_source_pinyin, valid_syllables, context)
        except Exception as error:  # noqa: BLE001
            codepoints = ' '.join(hex(ord(char)) for char in normalized_source_pinyin)
            raise RuntimeError(
                f'{context} failed for raw pinyin {normalized_source_pinyin!r} ({codepoints}): {error}'
            ) from error
        definitions = normalize_definitions(raw_english)

        if not hanzi or not pinyin or not definitions:
            raise RuntimeError(f'Missing normalized data for {context}')

        entries.append({
            'id': starting_id + len(entries),
            'level': level,
            'sourceUrl': get_level_url(level),
            'sourceRow': source_row,
            'rawChinese': raw_chinese,
            'rawPinyin': raw_pinyin,
            'rawEnglish': raw_english,
            'hanzi': hanzi,
            'pinyin': pinyin,
            'translations': {
                'eng': definitions,
            },
        })

    expected_count = EXPECTED_COUNTS[level]
    if len(entries) != expected_count:
        raise RuntimeError(f'HSK {level} expected {expected_count} rows but parsed {len(entries)}')

    return entries


def main():
    valid_syllables = load_valid_syllables(VALID_PINYIN_PATH)
    all_entries = []
    next_id = 1

    try:
        for level in LEVELS:
            url = get_level_url(level)
            print(f'Fetching HSK {level} from {url}...')
            html = fetch_html(url)
            level_entries = parse_level_page(level, html, next_id, valid_syllables)
            print(f'HSK {level}: parsed {len(level_entries)} rows.')

            all_entries.extend(level_entries)
            next_id += len(level_entries)

            if level != LEVELS[-1]:
                time.sleep(0.35)

        expected_total = sum(EXPECTED_COUNTS.values())
        if len(all_entries) != expected_total:
            raise RuntimeError(f'Expected {expected_total} total rows but got {len(all_entries)}')

        OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_FILE.write_text(json.dumps(all_entries, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')
        print(f'Success! Wrote {len(all_entries)} entries to {OUTPUT_FILE}')
    except Exception as error:  # noqa: BLE001
        print(f'HSK 3.0 generation failed: {error}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
