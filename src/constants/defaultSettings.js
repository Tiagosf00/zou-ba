export const DEFAULT_SETTINGS = {
    hskLevels: [1],
    inputMode: 'hanzi',
    outputMode: 'pinyin',
    themeMode: 'light',
};

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
    value === 'hanzi' || value === 'pinyin' || value === 'eng' ? value : fallback;

export const normalizeSettings = (value) => ({
    hskLevels: sanitizeLevels(value?.hskLevels),
    inputMode: sanitizeMode(value?.inputMode, DEFAULT_SETTINGS.inputMode),
    outputMode: sanitizeMode(value?.outputMode, DEFAULT_SETTINGS.outputMode),
    themeMode: value?.themeMode === 'dark' ? 'dark' : DEFAULT_SETTINGS.themeMode,
});
