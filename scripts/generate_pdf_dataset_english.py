from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "assets" / "hsk_1_6_pdf_dataset.csv"
DEFAULT_PROJECT = ROOT / "assets" / "hsk.json"
DEFAULT_OUTPUT = ROOT / "assets" / "hsk_1_6_pdf_dataset_english.csv"
DEFAULT_VALID_PINYIN = ROOT / "src" / "data" / "validPinyin.js"
TMP_DEPENDENCY_PATH = Path("/tmp/hsk_translate_deps")

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if TMP_DEPENDENCY_PATH.exists() and str(TMP_DEPENDENCY_PATH) not in sys.path:
    sys.path.insert(0, str(TMP_DEPENDENCY_PATH))

from pinyin_helpers import clean_cell_text, load_valid_syllables, normalize_pinyin

try:
    from hanzipy.dictionary import HanziDictionary
except ImportError as exc:  # pragma: no cover - runtime environment guard
    raise SystemExit(
        "hanzipy is required. Install it with "
        "`python3 -m pip install --target /tmp/hsk_translate_deps hanzipy`."
    ) from exc


TONE_CHAR_MAP = {
    "ā": ("a", "1"),
    "á": ("a", "2"),
    "ǎ": ("a", "3"),
    "à": ("a", "4"),
    "ē": ("e", "1"),
    "é": ("e", "2"),
    "ě": ("e", "3"),
    "è": ("e", "4"),
    "ī": ("i", "1"),
    "í": ("i", "2"),
    "ǐ": ("i", "3"),
    "ì": ("i", "4"),
    "ō": ("o", "1"),
    "ó": ("o", "2"),
    "ǒ": ("o", "3"),
    "ò": ("o", "4"),
    "ū": ("u", "1"),
    "ú": ("u", "2"),
    "ǔ": ("u", "3"),
    "ù": ("u", "4"),
    "ǖ": ("ü", "1"),
    "ǘ": ("ü", "2"),
    "ǚ": ("ü", "3"),
    "ǜ": ("ü", "4"),
    "ń": ("n", "2"),
    "ň": ("n", "3"),
    "ǹ": ("n", "4"),
    "ḿ": ("m", "2"),
    "Ā": ("a", "1"),
    "Á": ("a", "2"),
    "Ǎ": ("a", "3"),
    "À": ("a", "4"),
    "Ē": ("e", "1"),
    "É": ("e", "2"),
    "Ě": ("e", "3"),
    "È": ("e", "4"),
    "Ī": ("i", "1"),
    "Í": ("i", "2"),
    "Ǐ": ("i", "3"),
    "Ì": ("i", "4"),
    "Ō": ("o", "1"),
    "Ó": ("o", "2"),
    "Ǒ": ("o", "3"),
    "Ò": ("o", "4"),
    "Ū": ("u", "1"),
    "Ú": ("u", "2"),
    "Ǔ": ("u", "3"),
    "Ù": ("u", "4"),
    "Ǖ": ("ü", "1"),
    "Ǘ": ("ü", "2"),
    "Ǚ": ("ü", "3"),
    "Ǜ": ("ü", "4"),
    "Ń": ("n", "2"),
    "Ň": ("n", "3"),
    "Ǹ": ("n", "4"),
    "Ḿ": ("m", "2"),
}

NOUNISH_GLOSSES = {
    "car",
    "day",
    "ear",
    "eye",
    "face",
    "family",
    "foot",
    "hand",
    "head",
    "heart",
    "home",
    "leg",
    "line",
    "month",
    "mouth",
    "name",
    "people",
    "person",
    "place",
    "road",
    "row",
    "thing",
    "time",
    "visit",
    "year",
}

ROW_MANUAL_OVERRIDES = {
    ("个", "gè"): {
        "english_translation": "general measure word",
        "detailed_english_translation": (
            "A very common general measure word used with many nouns, especially when "
            "counting people or everyday objects."
        ),
    },
    ("本", "běn"): {
        "english_translation": "measure word for books",
        "detailed_english_translation": (
            "A measure word used for books, magazines, notebooks, and other bound items."
        ),
    },
    ("吧", "ba"): {
        "english_translation": "sentence-final particle",
        "detailed_english_translation": (
            "When placed at the end of a sentence, it usually softens a suggestion, request, "
            "or guess. Its exact tone depends on the context."
        ),
    },
    ("把", "bǎ"): {
        "english_translation": "ba construction marker",
        "detailed_english_translation": (
            "As a verb, it can mean 'to hold' or 'to grasp.' As a grammar particle, it marks "
            "the object in a sentence pattern that emphasizes what is done to something."
        ),
    },
    ("被", "bèi"): {
        "english_translation": "passive marker",
        "detailed_english_translation": (
            "Used before the doer of an action in a passive sentence. It shows that the subject "
            "is affected by what someone else does."
        ),
    },
    ("的", "de"): {
        "english_translation": "possessive particle",
        "detailed_english_translation": (
            "Usually links a modifier to a noun, often like 'of' or the English possessive "
            "ending. It is one of the most common grammar particles in Chinese."
        ),
    },
    ("地", "de"): {
        "english_translation": "adverbial particle",
        "detailed_english_translation": (
            "Placed after an adverbial phrase and before a verb. It links the manner or attitude "
            "of an action to the verb that follows."
        ),
    },
    ("得", "de"): {
        "english_translation": "complement particle",
        "detailed_english_translation": (
            "Placed after a verb or adjective and before a complement. It introduces information "
            "about degree, result, or possibility."
        ),
    },
    ("第", "dì"): {
        "english_translation": "ordinal prefix",
        "detailed_english_translation": (
            "Placed before a number to form an ordinal expression such as 'first,' 'second,' or "
            "'third.'"
        ),
    },
    ("过", "guo"): {
        "english_translation": "experiential particle",
        "detailed_english_translation": (
            "Placed after a verb to show that someone has had the experience of doing something "
            "before."
        ),
    },
    ("跟", "gēn"): {
        "english_translation": "with",
        "detailed_english_translation": (
            "Most commonly means 'with' when linking people or things. In other contexts, it can "
            "also mean 'to follow.'"
        ),
    },
    ("给", "gěi"): {
        "english_translation": "give",
        "detailed_english_translation": (
            "Usually means 'to give.' It can also be used before another noun or verb to express "
            "'for' or 'to' in everyday speech."
        ),
    },
    ("还是", "háishi"): {
        "english_translation": "or",
        "detailed_english_translation": (
            "In questions, it often means 'or' when giving a choice between options. In other "
            "contexts, it can also mean 'still' or suggest that something is better."
        ),
    },
    ("家", "jiā"): {
        "english_translation": "home",
        "detailed_english_translation": (
            "Usually means 'home' or 'family.' It can also be used as a measure word for "
            "households or businesses, and as a suffix for specialists."
        ),
    },
    ("了", "le"): {
        "english_translation": "aspect particle",
        "detailed_english_translation": (
            "Often marks a completed action or a change of situation. Its exact meaning depends "
            "on where it appears in the sentence."
        ),
    },
    ("两", "liǎng"): {
        "english_translation": "two",
        "detailed_english_translation": (
            "The number two. In everyday Mandarin, it is often used instead of 二 before measure "
            "words and many nouns."
        ),
    },
    ("吗", "ma"): {
        "english_translation": "question particle",
        "detailed_english_translation": (
            "Placed at the end of a statement to turn it into a yes-no question."
        ),
    },
    ("嘛", "ma"): {
        "english_translation": "sentence-final particle",
        "detailed_english_translation": (
            "A sentence-final particle that can make a statement sound obvious, persuasive, or a "
            "little casual. Its tone depends on the context."
        ),
    },
    ("们", "men"): {
        "english_translation": "plural suffix",
        "detailed_english_translation": (
            "Added after pronouns and some words for people to show a plural meaning, like "
            "'-s' in English."
        ),
    },
    ("呢", "ne"): {
        "english_translation": "sentence-final particle",
        "detailed_english_translation": (
            "Often used at the end of a sentence to keep a question or situation open. It can "
            "also be used to ask 'what about...?'"
        ),
    },
    ("啊", "a"): {
        "english_translation": "sentence-final particle",
        "detailed_english_translation": (
            "A common sentence-final particle that adds tone or emotion. It can soften a "
            "statement, show surprise, or make speech sound more natural."
        ),
    },
    ("让", "ràng"): {
        "english_translation": "let",
        "detailed_english_translation": (
            "Usually means 'to let' or 'to allow.' It can also be used to show that someone "
            "causes or asks another person to do something."
        ),
    },
    ("似的", "shìde"): {
        "english_translation": "as if",
        "detailed_english_translation": (
            "Used after a phrase to compare something to the way something else seems or feels. "
            "It often works like 'as if' or 'as though.'"
        ),
    },
    ("所", "suǒ"): {
        "english_translation": "nominalizing particle",
        "detailed_english_translation": (
            "A formal particle that turns the following verb phrase into a noun-like expression. "
            "It often appears in written or formal language."
        ),
    },
    ("所以", "suǒyǐ"): {
        "english_translation": "so",
        "detailed_english_translation": (
            "Used to introduce a result or conclusion. It often follows a reason introduced "
            "earlier in the sentence."
        ),
    },
    ("往", "wǎng"): {
        "english_translation": "toward",
        "detailed_english_translation": (
            "Usually means 'toward' or 'in the direction of.' It can also be used as a verb "
            "meaning 'to go toward.'"
        ),
    },
    ("在", "zài"): {
        "english_translation": "be at",
        "detailed_english_translation": (
            "Usually means 'to be at' or 'to be in' a place. Before another verb, it can also "
            "mark an action that is in progress."
        ),
    },
    ("着", "zhe"): {
        "english_translation": "durative particle",
        "detailed_english_translation": (
            "Placed after a verb to show that a state continues or that an action is ongoing."
        ),
    },
    ("之", "zhī"): {
        "english_translation": "formal linking particle",
        "detailed_english_translation": (
            "A formal written particle that links words, often in a way similar to 'of.' It is "
            "much more common in formal or literary Chinese than in everyday speech."
        ),
    },
    ("则", "zé"): {
        "english_translation": "then",
        "detailed_english_translation": (
            "Usually introduces a corresponding result, contrast, or conclusion. It is more common "
            "in formal writing than in casual conversation."
        ),
    },
    ("足", "zú"): {
        "english_translation": "enough",
        "detailed_english_translation": (
            "Means 'enough' or 'sufficient.' In formal language, it often describes something as "
            "fully adequate for a purpose."
        ),
    },
    ("电动车", "diàndòngchē"): {
        "english_translation": "electric vehicle",
        "detailed_english_translation": (
            "Refers to a vehicle powered by electricity, such as an electric car, scooter, or bike."
        ),
    },
    ("大厦", "dàshà"): {
        "english_translation": "large building",
        "detailed_english_translation": (
            "Refers to a large building, often an office building or high-rise."
        ),
    },
    ("占比", "zhànbǐ"): {
        "english_translation": "proportion",
        "detailed_english_translation": (
            "Refers to the share or percentage that one part makes up of a whole."
        ),
    },
    ("新媒体", "xīnméitǐ"): {
        "english_translation": "new media",
        "detailed_english_translation": (
            "Refers to digital or online media, especially internet-based platforms and content."
        ),
    },
    ("新能源", "xīnnéngyuán"): {
        "english_translation": "new energy",
        "detailed_english_translation": (
            "Refers to newer forms of energy, especially renewable or alternative energy sources."
        ),
    },
    ("下功夫", "xià gōngfu"): {
        "english_translation": "make an effort",
        "detailed_english_translation": (
            "Means to put in serious time and effort to improve or achieve something."
        ),
    },
    ("小偷儿", "xiǎotōur"): {
        "english_translation": "thief",
        "detailed_english_translation": (
            "Refers to a thief, especially someone who steals small things."
        ),
    },
    ("没法儿", "méifǎr"): {
        "english_translation": "no way",
        "detailed_english_translation": (
            "Means there is no way to do something or no workable solution in the situation."
        ),
    },
    ("浴室", "yùshì"): {
        "english_translation": "bathroom",
        "detailed_english_translation": (
            "Refers to a bathroom or washroom, especially one used for bathing or showering."
        ),
    },
    ("多", "duō"): {
        "english_translation": "many",
        "detailed_english_translation": (
            "Usually means 'many' or 'much.' It can also mean 'more' when making comparisons."
        ),
    },
    ("行", "xíng"): {
        "english_translation": "okay",
        "detailed_english_translation": (
            "Often means something is okay, possible, or acceptable. As a verb, it can also mean "
            "that something works or is doable."
        ),
    },
    ("行", "háng"): {
        "english_translation": "line of work",
        "detailed_english_translation": (
            "Refers to a trade, profession, or line of business. It can also refer to a row or "
            "line in some contexts."
        ),
    },
    ("因为", "yīnwèi"): {
        "english_translation": "because",
        "detailed_english_translation": (
            "Introduces a reason or cause. It is often paired with 所以 to give a reason-result pattern."
        ),
    },
    ("的话", "dehuà"): {
        "english_translation": "if",
        "detailed_english_translation": (
            "Used after a clause to mark it as a condition, similar to saying 'if' in English."
        ),
    },
}

NUMBER_GLOSSES = {
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "hundred",
    "thousand",
    "ten thousand",
    "million",
    "billion",
    "half",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add simple and detailed English translations to the PDF HSK dataset."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--project", type=Path, default=DEFAULT_PROJECT)
    parser.add_argument("--valid-pinyin", type=Path, default=DEFAULT_VALID_PINYIN)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def split_outside_parentheses(text: str, separators: str) -> list[str]:
    parts: list[str] = []
    buffer: list[str] = []
    depth = 0

    for char in text:
        if char in "([（":
            depth += 1
        elif char in ")]）" and depth > 0:
            depth -= 1

        if depth == 0 and char in separators:
            piece = "".join(buffer).strip()
            if piece:
                parts.append(piece)
            buffer = []
        else:
            buffer.append(char)

    piece = "".join(buffer).strip()
    if piece:
        parts.append(piece)

    return parts


def prepare_pinyin(text: str) -> str:
    cleaned = text.replace("／", "/").replace("—", "-").replace("–", "-")
    return re.split(r"\s*/\s*", cleaned, 1)[0]


def syllable_to_numeric(syllable: str) -> str:
    tone = "5"
    chars: list[str] = []

    for char in syllable:
        if char in TONE_CHAR_MAP:
            base, tone = TONE_CHAR_MAP[char]
            chars.append(base)
        elif char.isdigit():
            tone = char
        elif char.lower() in "abcdefghijklmnopqrstuvwxyzü":
            chars.append(char.lower())

    base = "".join(chars).replace("u:", "ü").replace("v", "ü")
    return f"{base}{tone}" if base else ""


def build_pinyin_key(text: str, valid_syllables: set[str]) -> tuple[str, ...]:
    text = prepare_pinyin(text)

    try:
        normalized = normalize_pinyin(text, valid_syllables, text)
        return tuple(syllable_to_numeric(part) for part in normalized.split())
    except Exception:
        parts = [part for part in re.split(r"[\s\-’'·]+", text) if part]
        return tuple(
            candidate
            for candidate in (syllable_to_numeric(part) for part in parts)
            if candidate
        )


def build_plain_pinyin_key(text: str, valid_syllables: set[str]) -> tuple[str, ...]:
    return tuple(re.sub(r"[1-5]$", "", part) for part in build_pinyin_key(text, valid_syllables))


def split_glosses(text: str) -> list[str]:
    cleaned = clean_cell_text(text)
    cleaned = cleaned.replace("；", ";").replace("，", ",").replace("／", "/")
    cleaned = re.sub(r"\[[^\]]*]", "", cleaned)

    parts: list[str] = []
    for piece in split_outside_parentheses(cleaned, ";/"):
        parts.extend(split_outside_parentheses(piece, ","))

    return [part.strip(" .;,:") for part in parts if part.strip(" .;,:")]


def clean_gloss(gloss: str) -> str:
    cleaned = clean_cell_text(gloss)
    cleaned = re.sub(r"\[[^\]]*]", "", cleaned)
    cleaned = re.sub(r"CL:[^;,/]+", "", cleaned)
    cleaned = re.sub(
        r"\((?:idiom|literary|polite|tw|old|archaic|usually|often|fig\.?|literally|slang|dialect|abbr\.?)\)",
        "",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = cleaned.strip(" ;,./")

    while cleaned.startswith("(") and cleaned.endswith(")") and len(cleaned) > 2:
        cleaned = cleaned[1:-1].strip()

    if not re.search(r"[A-Za-z0-9]", cleaned):
        return ""

    return cleaned


def expand_glosses(glosses: list[str]) -> list[str]:
    expanded: list[str] = []

    for gloss in glosses:
        cleaned = clean_gloss(gloss)
        if not cleaned:
            continue
        expanded.append(cleaned)
        if cleaned.lower().startswith("to be "):
            expanded.append(cleaned[6:])

    return expanded


def gloss_badness(gloss: str) -> int:
    lowered = gloss.lower()
    score = 0

    for pattern in [
        "classifier",
        "cl:",
        "old variant",
        "person name",
        "place name",
        "see ",
        "surname ",
        "used for ",
        "used in ",
        "variant of",
    ]:
        if pattern in lowered:
            score += 5

    return score


def score_gloss(gloss: str, part_of_speech: str, source: str) -> float:
    cleaned = clean_gloss(gloss)
    if not cleaned:
        return -999.0

    lowered = cleaned.lower()
    english_words = re.findall(r"[A-Za-z][A-Za-z'-]*", cleaned)
    word_count = len(english_words)
    score = 2.0 if source == "project" else 0.0
    score -= 5 * gloss_badness(cleaned)

    if 1 <= word_count <= 3:
        score += 8
    elif word_count <= 5:
        score += 4
    else:
        score -= min(word_count - 5, 5)

    if lowered.startswith("to be "):
        if any(tag in part_of_speech for tag in ["形", "副"]):
            score += 3
        elif "动" in part_of_speech:
            score += 1
    elif lowered.startswith("to "):
        score += 3 if "动" in part_of_speech else -2
    else:
        score += 1

    if any(tag in part_of_speech for tag in ["助", "叹", "前缀", "后缀"]) and any(
        word in lowered for word in ["auxiliary", "interjection", "particle", "prefix", "suffix"]
    ):
        score += 4

    if "数" in part_of_speech and any(
        word in lowered
        for word in [
            "billion",
            "eight",
            "first",
            "five",
            "four",
            "hundred",
            "million",
            "nine",
            "one",
            "second",
            "seven",
            "six",
            "ten",
            "thousand",
            "three",
            "two",
        ]
    ):
        score += 4

    if "量" in part_of_speech and any(word in lowered for word in ["classifier", "measure word"]):
        score += 4

    if ("形" in part_of_speech or "副" in part_of_speech) and "名" not in part_of_speech:
        if lowered in NOUNISH_GLOSSES:
            score -= 4
        if "副" in part_of_speech and "形" not in part_of_speech and lowered.endswith("ly"):
            score += 2

    score -= len(cleaned) / 60
    return score


def prefer_direct_project_simple(raw_english: str) -> bool:
    if not raw_english:
        return False
    if any(separator in raw_english for separator in [";", "/", ",", "；", "，"]):
        return False
    english_words = re.findall(r"[A-Za-z][A-Za-z'-]*", raw_english)
    return 1 <= len(english_words) <= 3


def choose_project_row(
    row: dict[str, str],
    project_by_hanzi: dict[str, list[dict[str, object]]],
    valid_syllables: set[str],
) -> dict[str, object] | None:
    candidates = project_by_hanzi.get(row["hanzi"], [])
    if not candidates:
        return None

    row_key = build_pinyin_key(row["pinyin"], valid_syllables)
    row_plain_key = build_plain_pinyin_key(row["pinyin"], valid_syllables)
    scored: list[tuple[float, dict[str, object]]] = []

    for candidate in candidates:
        candidate_key = build_pinyin_key(str(candidate["pinyin"]), valid_syllables)
        candidate_plain_key = build_plain_pinyin_key(str(candidate["pinyin"]), valid_syllables)
        score = 0.0

        if candidate_key and row_key and candidate_key == row_key:
            score += 100
        elif candidate_plain_key and row_plain_key and candidate_plain_key == row_plain_key:
            score += 40
        elif len(candidates) > 1:
            continue

        score -= abs(int(candidate["level"]) - int(row["hsk_level"]))
        scored.append((score, candidate))

    return max(scored, default=(0.0, None), key=lambda item: item[0])[1]


def choose_dictionary_entry(
    row: dict[str, str],
    dictionary: HanziDictionary,
    valid_syllables: set[str],
) -> dict[str, str] | None:
    try:
        entries = dictionary.definition_lookup(row["hanzi"])
    except Exception:
        return None

    row_key = build_pinyin_key(row["pinyin"], valid_syllables)
    row_plain_key = build_plain_pinyin_key(row["pinyin"], valid_syllables)
    best_entry: dict[str, str] | None = None
    best_score = -999.0

    for entry in entries:
        entry_key = build_pinyin_key(entry["pinyin"], valid_syllables)
        entry_plain_key = build_plain_pinyin_key(entry["pinyin"], valid_syllables)
        score = 0.0

        if entry_key and row_key and entry_key == row_key:
            score += 100
        elif entry_plain_key and row_plain_key and entry_plain_key == row_plain_key:
            score += 40

        definition = entry["definition"].lower()
        if definition.startswith("see ") or "variant of" in definition:
            score -= 20
        if "surname " in definition:
            score -= 10

        score += min(5, len(entry["definition"]) / 40)
        if score > best_score:
            best_entry = entry
            best_score = score

    return best_entry


def collect_project_glosses(project_row: dict[str, object] | None) -> list[str]:
    if not project_row:
        return []

    collected: list[str] = []
    for gloss in project_row.get("translations", {}).get("eng", []):
        collected.extend(split_glosses(str(gloss)))
    collected.extend(split_glosses(str(project_row.get("rawEnglish", ""))))
    return expand_glosses(collected)


def collect_dictionary_glosses(dictionary_entry: dict[str, str] | None) -> list[str]:
    if not dictionary_entry:
        return []
    return expand_glosses(split_glosses(dictionary_entry["definition"]))


def build_compound_examples(rows: list[dict[str, str]]) -> dict[str, list[str]]:
    examples: dict[str, list[str]] = {}
    seen_words = {row["hanzi"] for row in rows}

    for word in sorted(seen_words):
        if len(word) != 1:
            continue

        compounds: list[tuple[int, int, int, str]] = []
        used: set[str] = set()
        for row in rows:
            candidate = row["hanzi"]
            if len(candidate) <= 1 or word not in candidate or candidate in used:
                continue
            used.add(candidate)
            compounds.append((int(row["hsk_level"]), len(candidate), int(row["id"]), candidate))

        compounds.sort()
        examples[word] = [compound for _, _, _, compound in compounds[:4]]

    return examples


@lru_cache(maxsize=None)
def format_manual_detail(word: str, compound_examples_json: str) -> str:
    compound_examples = json.loads(compound_examples_json)
    manual = MANUAL_OVERRIDES[word]["detailed_english_translation"]
    if len(word) == 1 and compound_examples.get(word):
        return f"{manual}; common compounds: {', '.join(compound_examples[word])}"
    return manual


def build_translation_fields(
    row: dict[str, str],
    project_row: dict[str, object] | None,
    dictionary_entry: dict[str, str] | None,
    compound_examples: dict[str, list[str]],
) -> tuple[str, str]:
    if row["hanzi"] in MANUAL_OVERRIDES:
        manual = MANUAL_OVERRIDES[row["hanzi"]]
        detail = format_manual_detail(row["hanzi"], json.dumps(compound_examples, ensure_ascii=False))
        return manual["english_translation"], detail

    project_glosses = collect_project_glosses(project_row)
    dictionary_glosses = collect_dictionary_glosses(dictionary_entry)

    preferred_simple = ""
    if project_row and prefer_direct_project_simple(str(project_row.get("rawEnglish", ""))):
        preferred_simple = clean_gloss(str(project_row["rawEnglish"]))

    scored_glosses: list[tuple[float, str]] = []
    seen_for_scoring: set[tuple[str, str]] = set()

    for gloss in project_glosses:
        cleaned = clean_gloss(gloss)
        if cleaned and (cleaned.lower(), "project") not in seen_for_scoring:
            scored_glosses.append((score_gloss(cleaned, row["part_of_speech"], "project"), cleaned))
            seen_for_scoring.add((cleaned.lower(), "project"))

    for gloss in dictionary_glosses:
        cleaned = clean_gloss(gloss)
        if cleaned and (cleaned.lower(), "dict") not in seen_for_scoring:
            scored_glosses.append((score_gloss(cleaned, row["part_of_speech"], "dict"), cleaned))
            seen_for_scoring.add((cleaned.lower(), "dict"))

    scored_glosses.sort(key=lambda item: item[0], reverse=True)
    english_translation = preferred_simple or (scored_glosses[0][1] if scored_glosses else "")

    detailed_parts: list[str] = []
    seen_detailed: set[str] = set()
    for gloss in [english_translation, *project_glosses, *dictionary_glosses]:
        cleaned = clean_gloss(gloss)
        key = cleaned.lower()
        if not cleaned or key in seen_detailed or gloss_badness(cleaned) >= 5:
            continue
        detailed_parts.append(cleaned)
        seen_detailed.add(key)
        if len(detailed_parts) >= 6:
            break

    if not detailed_parts and english_translation:
        detailed_parts.append(english_translation)

    if len(row["hanzi"]) == 1 and compound_examples.get(row["hanzi"]):
        detailed_parts.append(f"common compounds: {', '.join(compound_examples[row['hanzi']])}")

    detailed_translation = "; ".join(detailed_parts).strip()
    return english_translation, detailed_translation


def main() -> None:
    args = parse_args()
    valid_syllables = load_valid_syllables(args.valid_pinyin)
    dictionary = HanziDictionary()

    pdf_rows = list(csv.DictReader(args.input.open(encoding="utf-8", newline="")))
    project_rows = json.loads(args.project.read_text(encoding="utf-8"))

    project_by_hanzi: dict[str, list[dict[str, object]]] = defaultdict(list)
    for project_row in project_rows:
        project_by_hanzi[str(project_row["hanzi"])].append(project_row)

    compound_examples = build_compound_examples(pdf_rows)
    output_rows: list[dict[str, str]] = []
    source_counts = {"dictionary_only": 0, "manual": 0, "project_and_dictionary": 0, "project_only": 0}

    for row in pdf_rows:
        project_row = choose_project_row(row, project_by_hanzi, valid_syllables)
        dictionary_entry = choose_dictionary_entry(row, dictionary, valid_syllables)
        english_translation, detailed_translation = build_translation_fields(
            row=row,
            project_row=project_row,
            dictionary_entry=dictionary_entry,
            compound_examples=compound_examples,
        )

        if row["hanzi"] in MANUAL_OVERRIDES:
            source_counts["manual"] += 1
        elif project_row and dictionary_entry:
            source_counts["project_and_dictionary"] += 1
        elif project_row:
            source_counts["project_only"] += 1
        else:
            source_counts["dictionary_only"] += 1

        output_rows.append(
            {
                "id": row["id"],
                "hsk_level": row["hsk_level"],
                "hanzi": row["hanzi"],
                "pinyin": row["pinyin"],
                "english_translation": english_translation,
                "detailed_english_translation": detailed_translation,
            }
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "id",
                "hsk_level",
                "hanzi",
                "pinyin",
                "english_translation",
                "detailed_english_translation",
            ],
        )
        writer.writeheader()
        writer.writerows(output_rows)

    blank_simple = sum(1 for row in output_rows if not row["english_translation"])
    blank_detailed = sum(1 for row in output_rows if not row["detailed_english_translation"])
    print(f"Wrote {len(output_rows)} rows to {args.output}")
    print(f"Blank english_translation rows: {blank_simple}")
    print(f"Blank detailed_english_translation rows: {blank_detailed}")
    print(f"Source counts: {json.dumps(source_counts, ensure_ascii=False, sort_keys=True)}")


if __name__ == "__main__":
    main()
