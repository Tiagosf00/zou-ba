import { VOCABULARY_POOLS } from '../constants/defaultSettings';

export const getHskLevelSummary = (levels = []) => {
    if (levels.length === 6) {
        return 'HSK 1-6';
    }

    return levels.map((level) => `HSK ${level}`).join(' · ');
};

export const isCustomVocabularyPool = (settings) =>
    settings?.vocabularyPool === VOCABULARY_POOLS.CUSTOM;

export const getVocabularyPoolSummary = (settings) => {
    if (isCustomVocabularyPool(settings)) {
        const count = settings?.customCardIds?.length || 0;
        return `Custom · ${count} ${count === 1 ? 'word' : 'words'}`;
    }

    return getHskLevelSummary(settings?.hskLevels || []);
};

export const getVocabularyPoolItems = (items, settings) => {
    if (!Array.isArray(items)) {
        return [];
    }

    if (isCustomVocabularyPool(settings)) {
        const selectedIds = new Set(settings?.customCardIds || []);
        return items.filter((item) => selectedIds.has(Number(item.id)));
    }

    const selectedLevels = new Set(settings?.hskLevels || []);
    return items.filter((item) => selectedLevels.has(item.level));
};

