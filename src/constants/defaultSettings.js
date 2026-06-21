import hskData from '../../assets/hsk_1_6_pdf_dataset_english.json';

export const VOCABULARY_POOLS = {
    HSK: 'hsk',
    CUSTOM: 'custom',
};

export const DEFAULT_SETTINGS = {
    hskLevels: [1],
    vocabularyPool: VOCABULARY_POOLS.HSK,
    customCardIds: [],
    inputMode: 'hanzi',
    outputMode: 'pinyin',
    themeMode: 'light',
};
const VALID_MODES = ['hanzi', 'pinyin', 'eng', 'audio'];
const VALID_CUSTOM_CARD_IDS = new Set(hskData.map((item) => Number(item.id)));

const sanitizeLevels = (levels) => {
    if (!Array.isArray(levels)) {
        return DEFAULT_SETTINGS.hskLevels;
    }

    const nextLevels = Array.from(
        new Set(
            levels
                .map((level) => Number(level))
                .filter((level) => Number.isInteger(level) && level >= 1 && level <= 6),
        ),
    ).sort((left, right) => left - right);

    return nextLevels.length > 0 ? nextLevels : DEFAULT_SETTINGS.hskLevels;
};

const sanitizeMode = (value, fallback) =>
    VALID_MODES.includes(value) ? value : fallback;

const sanitizeVocabularyPool = (value) =>
    value === VOCABULARY_POOLS.CUSTOM ? VOCABULARY_POOLS.CUSTOM : DEFAULT_SETTINGS.vocabularyPool;

export const sanitizeCustomCardIds = (cardIds) => {
    if (!Array.isArray(cardIds)) {
        return DEFAULT_SETTINGS.customCardIds;
    }

    return Array.from(
        new Set(
            cardIds
                .map((cardId) => Number(cardId))
                .filter((cardId) => Number.isInteger(cardId) && VALID_CUSTOM_CARD_IDS.has(cardId)),
        ),
    ).sort((left, right) => left - right);
};

export const pickDistinctMode = (preferredMode, blockedMode) => {
    const sanitizedPreferredMode = sanitizeMode(preferredMode, DEFAULT_SETTINGS.outputMode);

    if (sanitizedPreferredMode !== blockedMode) {
        return sanitizedPreferredMode;
    }

    return VALID_MODES.find((mode) => mode !== blockedMode) || DEFAULT_SETTINGS.outputMode;
};

export const normalizeModePair = (inputMode, outputMode) => {
    const sanitizedInputMode = sanitizeMode(inputMode, DEFAULT_SETTINGS.inputMode);
    const sanitizedOutputMode = sanitizeMode(outputMode, DEFAULT_SETTINGS.outputMode);

    if (sanitizedInputMode !== sanitizedOutputMode) {
        return {
            inputMode: sanitizedInputMode,
            outputMode: sanitizedOutputMode,
        };
    }

    return {
        inputMode: sanitizedInputMode,
        outputMode: pickDistinctMode(DEFAULT_SETTINGS.outputMode, sanitizedInputMode),
    };
};

export const normalizeSettings = (value) => ({
    hskLevels: sanitizeLevels(value?.hskLevels),
    vocabularyPool: sanitizeVocabularyPool(value?.vocabularyPool),
    customCardIds: sanitizeCustomCardIds(value?.customCardIds),
    ...normalizeModePair(value?.inputMode, value?.outputMode),
    themeMode: value?.themeMode === 'dark' ? 'dark' : DEFAULT_SETTINGS.themeMode,
});
