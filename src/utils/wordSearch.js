const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const readingKey = value => normalize(String(value || '').replace(/u:|v/gi, 'ü')).replace(/[0-5\s'’·-]/g, '');

export const createWordSearchIndex = words => words.map(word => ({
    word,
    hanzi: normalize(word.hanzi),
    pinyin: readingKey(word.pinyin),
    meanings: (word.translations?.eng || [word.rawEnglish || '']).map(normalize),
}));

export const searchVocabulary = (index, query) => {
    const text = normalize(query);
    if (!text) return [];
    const reading = readingKey(query);
    const tokens = text.split(/\s+/);
    return index.flatMap(entry => {
        const { hanzi, pinyin, meanings } = entry;
        const words = meanings.join(' ');
        const score = hanzi === text ? 0
            : reading && pinyin === reading ? 1
            : meanings.includes(text) ? 2
            : hanzi.startsWith(text) || (reading && pinyin.startsWith(reading)) ? 3
            : hanzi.includes(text) || (reading && pinyin.includes(reading)) || tokens.every(token => words.includes(token)) ? 4 : -1;
        return score < 0 ? [] : [{ word: entry.word, score }];
    }).sort((a, b) => a.score - b.score || a.word.level - b.word.level || Number(a.word.id) - Number(b.word.id))
        .map(entry => entry.word);
};
