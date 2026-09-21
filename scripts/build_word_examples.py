"""Attach existing sentence recordings to syllabus entries without changing the syllabus."""

import argparse
from collections import defaultdict
import json
from html import unescape
from pathlib import Path
import unicodedata

from build_hsk_sentence_deck import collect_package_records

ROOT = Path(__file__).resolve().parents[1]

# Reviewed homographs in this syllabus. Exact source glosses prevent mixing senses.
SENSES = {
    (2, '花', 'spend'): 'to spend (money or time)',
    (2, '花', 'flower'): 'flower',
    (4, '生', 'give birth'): 'to give birth, to produce, to grow',
    (4, '生', 'raw'): 'raw, uncooked, unripe; very, extremely, terribly',
    (5, '批', 'batch'): 'measure word for batches',
    (5, '批', 'criticize; approve'): 'to criticize, to approve',
}


def reading_key(value):
    # Keep tone marks and ü: homographs with different readings must stay separate.
    return ''.join(c for c in unicodedata.normalize('NFC', unescape(value)).lower()
                   if c.isalpha())


def build_examples(words, sentences, records):
    by_text = defaultdict(list)
    for sentence in sentences:
        by_text[sentence['chinese']].append(sentence)
    candidates = defaultdict(dict)
    for record in records:
        key = (record['level'], record['focusWord'], reading_key(record['focusPinyin']))
        for sentence in by_text[record['chinese']]:
            # Deduplicated sentences can have another original focus word. The source
            # note still supplies the precise reading association for this entry.
            if (sentence['pinyin'] == record['pinyin'] and
                    sentence['translation'] == record['translation'] and
                    record['focusWord'] in sentence['chinese']):
                candidates[key][sentence['id']] = unescape(record['focusMeaning'])
    entries = {}
    unmatched = []
    for word in words:
        key = (word['level'], word['hanzi'], reading_key(word['pinyin']))
        sense = SENSES.get((word['level'], word['hanzi'], word['rawEnglish']))
        ids = [sid for sid, meaning in candidates.get(key, {}).items()
               if sense is None or meaning == sense]
        if ids:
            entries[str(word['id'])] = {
                'hanzi': word['hanzi'], 'level': word['level'],
                'pinyin': word['pinyin'], 'sentenceIds': ids,
                **({'meaning': word['rawEnglish']} if sense is not None else {}),
            }
        else:
            unmatched.append({k: word[k] for k in ('id', 'level', 'hanzi', 'pinyin')})
    return {'source': 'https://ankiweb.net/shared/info/258311532',
            'entries': entries, 'unmatched': unmatched}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('packages', nargs='+', type=Path)
    args = parser.parse_args()
    words = json.loads((ROOT / 'assets/hsk_1_6_pdf_dataset_english.json').read_text())
    sentences = json.loads((ROOT / 'assets/hsk_sentences_audio.json').read_text())['sentences']
    records = [r for package in args.packages for r in collect_package_records(package)]
    result = build_examples(words, sentences, records)
    (ROOT / 'assets/hsk_word_examples.json').write_text(
        json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f"Matched {len(result['entries'])}/{len(words)} entries; {len(result['unmatched'])} need review.")
    for word in result['unmatched']:
        print(word)


if __name__ == '__main__':
    main()
