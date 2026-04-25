export const DEFAULT_SETTINGS = {
    hskLevels: [1],
    inputMode: 'hanzi',
    outputMode: 'pinyin',
    themeMode: 'light',
};
const VALID_MODES = ['hanzi', 'pinyin', 'eng'];

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
    ...normalizeModePair(value?.inputMode, value?.outputMode),
    themeMode: value?.themeMode === 'dark' ? 'dark' : DEFAULT_SETTINGS.themeMode,
});
