import json
import re


MANUAL_VALID_SYLLABLES = {'dei', 'den', 'ei', 'fo', 'hm', 'hng', 'lo', 'lüe', 'm', 'n', 'ng', 'nun', 'nüe', 'o', 'yo'}

PLAIN_PINYIN_CHAR_MAP = {
    'Ā': 'a',
    'Á': 'a',
    'Ǎ': 'a',
    'À': 'a',
    'ā': 'a',
    'á': 'a',
    'ǎ': 'a',
    'à': 'a',
    'Ē': 'e',
    'É': 'e',
    'Ě': 'e',
    'È': 'e',
    'ē': 'e',
    'é': 'e',
    'ě': 'e',
    'è': 'e',
    'Ê': 'e',
    'ê': 'e',
    'Ī': 'i',
    'Í': 'i',
    'Ǐ': 'i',
    'Ì': 'i',
    'ī': 'i',
    'í': 'i',
    'ǐ': 'i',
    'ì': 'i',
    'Ō': 'o',
    'Ó': 'o',
    'Ǒ': 'o',
    'Ò': 'o',
    'ō': 'o',
    'ó': 'o',
    'ǒ': 'o',
    'ò': 'o',
    'Ū': 'u',
    'Ú': 'u',
    'Ǔ': 'u',
    'Ù': 'u',
    'ū': 'u',
    'ú': 'u',
    'ǔ': 'u',
    'ù': 'u',
    'Ǖ': 'ü',
    'Ǘ': 'ü',
    'Ǚ': 'ü',
    'Ǜ': 'ü',
    'ǖ': 'ü',
    'ǘ': 'ü',
    'ǚ': 'ü',
    'ǜ': 'ü',
    'Ü': 'ü',
    'ü': 'ü',
    'Ń': 'n',
    'Ň': 'n',
    'Ǹ': 'n',
    'ń': 'n',
    'ň': 'n',
    'ǹ': 'n',
    'Ḿ': 'm',
    'ḿ': 'm',
}


def clean_cell_text(value):
    return re.sub(r'\s+', ' ', value.replace('\xa0', ' ')).strip()


def get_primary_variant(value):
    return clean_cell_text(value).split('|', 1)[0].split('｜', 1)[0].strip()


def strip_parentheticals(value):
    return clean_cell_text(
        re.sub(r'\[[^\]]*]', '', re.sub(r'\([^)]*\)', '', re.sub(r'（[^）]*）', '', value)))
    )


def normalize_chinese(raw_chinese):
    return re.sub(r'\s+', '', strip_parentheticals(get_primary_variant(raw_chinese)))


def to_plain_pinyin_char(char):
    if char in PLAIN_PINYIN_CHAR_MAP:
        return PLAIN_PINYIN_CHAR_MAP[char]

    lower_char = char.lower()
    if re.match(r'[a-z]', lower_char):
        return lower_char

    return ''


def to_plain_pinyin(text):
    return ''.join(to_plain_pinyin_char(char) for char in text.strip())


def load_valid_syllables(valid_pinyin_path):
    content = valid_pinyin_path.read_text(encoding='utf-8')
    raw_list_match = re.search(r'const rawList = "([^"]+)"', content, re.S)
    if raw_list_match:
        syllables = {
            item.strip()
            for item in raw_list_match.group(1).split(',')
            if item.strip()
        }
    else:
        set_match = re.search(r'new Set\((\[[\s\S]*?\])\)', content)
        if not set_match:
            raise RuntimeError(f'Unable to parse valid syllables from {valid_pinyin_path}')
        syllables = set(json.loads(set_match.group(1)))

    return syllables | MANUAL_VALID_SYLLABLES


def _segment_connected_token(token, valid_syllables, context):
    relevant_chars = [char for char in token if to_plain_pinyin_char(char)]
    if not relevant_chars:
        raise RuntimeError(f'No pinyin letters found in "{token}" ({context})')

    plain_token = ''.join(to_plain_pinyin_char(char) for char in relevant_chars)
    memo = {}

    def search(start_index):
        if start_index == len(plain_token):
            return []

        if start_index in memo:
            return memo[start_index]

        result = None
        max_length = min(len(plain_token), start_index + 6)
        for end_index in range(max_length, start_index, -1):
            candidate = plain_token[start_index:end_index]
            if candidate not in valid_syllables:
                continue

            remainder = search(end_index)
            if remainder is not None:
                result = [''.join(relevant_chars[start_index:end_index]), *remainder]
                break

        memo[start_index] = result
        return result

    segmented = search(0)
    if segmented is None:
        raise RuntimeError(f'Could not segment pinyin token "{token}" -> "{plain_token}" ({context})')

    return segmented


def normalize_pinyin(raw_pinyin, valid_syllables, context):
    primary_variant = strip_parentheticals(get_primary_variant(raw_pinyin))
    words = [word for word in re.split(r'\s+', primary_variant) if word]
    syllables = []

    for word in words:
        for chunk in [piece for piece in re.split(r"[’']", word) if piece]:
            if not any(to_plain_pinyin_char(char) for char in chunk):
                continue
            syllables.extend(_segment_connected_token(chunk, valid_syllables, context))

    if not syllables:
        raise RuntimeError(f'Unable to normalize pinyin "{raw_pinyin}" ({context})')

    return ' '.join(syllables).lower()


def normalize_definitions(raw_english):
    return [
        item.strip()
        for item in re.split(r'[;；]', clean_cell_text(raw_english))
        if item.strip()
    ]
