import examples from '../../assets/hsk_word_examples.json';
import deck from '../../assets/hsk_sentences_audio.json';

const byId = new Map(deck.sentences.map((sentence) => [sentence.id, sentence]));
const readingKey = (value) => String(value || '').normalize('NFC').toLowerCase().replace(/[\s'’\-]/g, '');
// Anki stores escaped text, including apostrophes in pinyin (e.g. nǚ&#x27;ér).
const plainText = (value) => String(value || '').replace(/&#(x[0-9a-f]+|\d+);|&(amp|quot|apos|lt|gt|nbsp);/gi,
    (match, code, named) => {
        if (!code) return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[named.toLowerCase()];
        const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
        return point <= 0x10ffff ? String.fromCodePoint(point) : match;
    });

export const getWordExamples = (item) => {
    const entry = examples.entries[String(item?.id)];
    if (entry && entry.hanzi === item.hanzi && entry.level === item.level &&
        readingKey(entry.pinyin) === readingKey(item.pinyin) &&
        (!entry.meaning || entry.meaning === item.rawEnglish)) {
        const matches = entry.sentenceIds.map((id) => byId.get(id)).filter(Boolean);
        if (matches.length) return matches.map((sentence) => ({
            ...sentence,
            chinese: plainText(sentence.chinese),
            pinyin: plainText(sentence.pinyin),
            translation: plainText(sentence.translation),
        }));
    }
    // Preserve manually supplied examples when there is no verified deck match.
    if (item?.exampleSentence?.trim()) {
        return [{
            id: `fallback-${item.id}`,
            chinese: item.exampleSentence.trim(),
            pinyin: item.examplePinyin?.trim() || '',
            translation: item.exampleEnglishTranslation?.trim() || '',
        }];
    }
    return [];
};
