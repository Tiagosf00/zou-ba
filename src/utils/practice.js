const OPTION_COUNT = 6;
const MAX_BOX = 5;
const BOX_REVIEW_DELAYS = [
    10 * 60 * 1000,
    24 * 60 * 60 * 1000,
    3 * 24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
    14 * 24 * 60 * 60 * 1000,
    30 * 24 * 60 * 60 * 1000,
];
const FAILED_CARD_DELAY = 2 * 60 * 1000;

export const DEFAULT_PROFILE_ID = 'default';
export const MINIMUM_ITEMS_PER_ROUND = OPTION_COUNT;

const shuffle = (items) => {
    const copy = [...items];

    for (let index = copy.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }

    return copy;
};

const uniqueById = (items) => {
    const seen = new Set();

    return items.filter((item) => {
        if (!item || seen.has(item.id)) {
            return false;
        }

        seen.add(item.id);
        return true;
    });
};

const toTimestamp = (value) => {
    if (!value) {
        return null;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
};

const getValidIsoString = (value) => {
    const timestamp = toTimestamp(value);
    return timestamp === null ? null : new Date(timestamp).toISOString();
};

const getNumericCount = (value) => {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
};

const clampBox = (value) => {
    const nextValue = Number.isFinite(value) ? Math.floor(value) : 0;
    return Math.min(Math.max(nextValue, 0), MAX_BOX);
};

const sanitizeCardProgress = (entry) => {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const lastReviewedAt = getValidIsoString(entry.lastReviewedAt);
    const nextReviewAt = getValidIsoString(entry.nextReviewAt);
    const lastResult = entry.lastResult === 'correct' || entry.lastResult === 'wrong'
        ? entry.lastResult
        : null;

    if (!lastReviewedAt || !nextReviewAt || !lastResult) {
        return null;
    }

    return {
        box: clampBox(entry.box),
        lastResult,
        correctCount: getNumericCount(entry.correctCount),
        wrongCount: getNumericCount(entry.wrongCount),
        unknownCount: getNumericCount(entry.unknownCount),
        consecutiveCorrect: getNumericCount(entry.consecutiveCorrect),
        lastReviewedAt,
        nextReviewAt,
    };
};

export const createPracticeProgress = (
    profileId = DEFAULT_PROFILE_ID,
    cards = {},
    updatedAt = new Date().toISOString(),
) => ({
    version: 1,
    profileId,
    cards,
    updatedAt,
});

export const normalizePracticeProgress = (
    value,
    profileId = DEFAULT_PROFILE_ID,
) => {
    if (!value || typeof value !== 'object') {
        return createPracticeProgress(profileId);
    }

    const cards = Object.fromEntries(
        Object.entries(value.cards || {}).flatMap(([cardId, entry]) => {
            const sanitized = sanitizeCardProgress(entry);
            return sanitized ? [[cardId, sanitized]] : [];
        }),
    );

    return createPracticeProgress(
        profileId,
        cards,
        getValidIsoString(value.updatedAt) || new Date().toISOString(),
    );
};

const getCardProgress = (cards, itemId) => cards?.[itemId] || null;

const isDue = (entry, nowTimestamp) => {
    const nextReviewAt = toTimestamp(entry?.nextReviewAt);

    if (nextReviewAt === null) {
        return false;
    }

    return nextReviewAt <= nowTimestamp;
};

const compareQuestionPriority = (firstItem, secondItem, cards, recentIds) => {
    const firstEntry = getCardProgress(cards, firstItem.id);
    const secondEntry = getCardProgress(cards, secondItem.id);
    const firstRecentPenalty = recentIds.includes(firstItem.id) ? 1 : 0;
    const secondRecentPenalty = recentIds.includes(secondItem.id) ? 1 : 0;

    if (firstRecentPenalty !== secondRecentPenalty) {
        return firstRecentPenalty - secondRecentPenalty;
    }

    const firstBox = firstEntry?.box ?? 0;
    const secondBox = secondEntry?.box ?? 0;

    if (firstBox !== secondBox) {
        return firstBox - secondBox;
    }

    const firstNextReviewAt = toTimestamp(firstEntry?.nextReviewAt) ?? 0;
    const secondNextReviewAt = toTimestamp(secondEntry?.nextReviewAt) ?? 0;

    if (firstNextReviewAt !== secondNextReviewAt) {
        return firstNextReviewAt - secondNextReviewAt;
    }

    return 0;
};

export const getMeaningLines = (item) => {
    const definitions = item?.translations?.eng?.filter(Boolean) || [];

    if (definitions.length > 0) {
        return definitions;
    }

    if (!item?.rawEnglish) {
        return [];
    }

    return item.rawEnglish
        .split(/;|,/)
        .map((chunk) => chunk.trim())
        .filter(Boolean);
};

export const getDetailedMeaning = (item) => {
    const detailedMeaning = item?.detailedEnglishTranslation?.trim();

    return detailedMeaning || null;
};

export const getPinyinSyllables = (item) => {
    if (!item?.pinyin) {
        return ['...'];
    }

    return item.pinyin.split(/\s+/).filter(Boolean);
};

export const getDisplayLines = (item, mode) => {
    if (!item) {
        return ['...'];
    }

    if (mode === 'eng') {
        const meaningLines = getMeaningLines(item).slice(0, 2);
        return meaningLines.length > 0 ? meaningLines : ['No meaning'];
    }

    if (mode === 'pinyin') {
        return getPinyinSyllables(item);
    }

    return [item.hanzi];
};

export const getDisplayText = (item, mode) => {
    if (!item) {
        return '...';
    }

    if (mode === 'eng') {
        return getDisplayLines(item, mode).join('\n');
    }

    if (mode === 'pinyin') {
        return item.pinyin;
    }

    return item.hanzi;
};

const getOptionDisplayKey = (item, mode) => {
    if (!item) {
        return '';
    }

    if (mode === 'pinyin') {
        return (item.pinyin || '').trim().toLowerCase();
    }

    if (mode === 'eng') {
        return getDisplayLines(item, mode)
            .join('\n')
            .trim()
            .toLowerCase();
    }

    return (item.hanzi || '').trim();
};

const pickUniqueDistractors = (candidates, question, answerMode) => {
    const usedKeys = new Set([getOptionDisplayKey(question, answerMode)]);
    const distractors = [];

    candidates.forEach((candidate) => {
        if (distractors.length >= OPTION_COUNT - 1) {
            return;
        }

        const displayKey = getOptionDisplayKey(candidate, answerMode);

        if (!displayKey || usedKeys.has(displayKey)) {
            return;
        }

        distractors.push(candidate);
        usedKeys.add(displayKey);
    });

    return distractors;
};

export const pickNextQuestion = (items, cards, now = new Date(), recentIds = []) => {
    if (!items || items.length === 0) {
        return null;
    }

    const nowTimestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const failedDueItems = [];
    const reviewDueItems = [];
    const newItems = [];

    items.forEach((item) => {
        const entry = getCardProgress(cards, item.id);

        if (!entry) {
            newItems.push(item);
            return;
        }

        if (!isDue(entry, nowTimestamp)) {
            return;
        }

        if (entry.lastResult === 'wrong') {
            failedDueItems.push(item);
            return;
        }

        reviewDueItems.push(item);
    });

    const pool = failedDueItems.length > 0
        ? failedDueItems
        : reviewDueItems.length > 0
          ? reviewDueItems
          : newItems;

    if (pool.length === 0) {
        return null;
    }

    return shuffle(pool).sort((firstItem, secondItem) =>
        compareQuestionPriority(firstItem, secondItem, cards, recentIds))[0];
};

export const getTrainingSnapshot = (items, cards, now = new Date()) => {
    const nowTimestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const boxCounts = Array.from({ length: MAX_BOX + 1 }, () => 0);
    let studiedCount = 0;
    let newCount = 0;
    let dueCount = 0;
    let scheduledCount = 0;
    let masteredCount = 0;

    (items || []).forEach((item) => {
        const entry = getCardProgress(cards, item.id);

        if (!entry) {
            newCount += 1;
            return;
        }

        studiedCount += 1;
        boxCounts[entry.box] += 1;

        if (isDue(entry, nowTimestamp)) {
            dueCount += 1;
        } else {
            scheduledCount += 1;
        }

        if (entry.box === MAX_BOX && entry.lastResult === 'correct') {
            masteredCount += 1;
        }
    });

    return {
        totalCount: items?.length || 0,
        studiedCount,
        newCount,
        dueCount,
        scheduledCount,
        masteredCount,
        readyNowCount: dueCount + newCount,
        boxCounts,
        completionRatio: items?.length ? studiedCount / items.length : 0,
    };
};

const compareWordStats = (firstWord, secondWord) => {
    const firstHasAttempts = firstWord.attemptCount > 0 ? 1 : 0;
    const secondHasAttempts = secondWord.attemptCount > 0 ? 1 : 0;

    if (firstHasAttempts !== secondHasAttempts) {
        return secondHasAttempts - firstHasAttempts;
    }

    if (firstWord.correctCount !== secondWord.correctCount) {
        return secondWord.correctCount - firstWord.correctCount;
    }

    if (firstWord.wrongCount !== secondWord.wrongCount) {
        return secondWord.wrongCount - firstWord.wrongCount;
    }

    const hanziComparison = (firstWord.hanzi || '').localeCompare(secondWord.hanzi || '');

    if (hanziComparison !== 0) {
        return hanziComparison;
    }

    return (firstWord.id || 0) - (secondWord.id || 0);
};

export const getWordStatsSnapshot = (items, cards) => {
    const words = (items || []).map((item) => {
        const entry = getCardProgress(cards, item.id);
        const correctCount = entry?.correctCount || 0;
        const wrongCount = entry?.wrongCount || 0;
        const unknownCount = entry?.unknownCount || 0;
        const attemptCount = correctCount + wrongCount + unknownCount;
        const meaningLines = getMeaningLines(item);

        return {
            ...item,
            correctCount,
            wrongCount,
            unknownCount,
            attemptCount,
            isStudied: !!entry,
            isMastered: entry?.box === MAX_BOX && entry?.lastResult === 'correct',
            meaningSummary:
                meaningLines.length > 0
                    ? meaningLines.slice(0, 2).join(', ')
                    : 'No meaning available.',
        };
    });

    const levels = Array.from(new Set(words.map((word) => word.level)))
        .sort((firstLevel, secondLevel) => firstLevel - secondLevel)
        .map((level) => {
            const levelWords = words
                .filter((word) => word.level === level)
                .sort(compareWordStats);
            const studiedCount = levelWords.filter((word) => word.isStudied).length;
            const totalCorrectCount = levelWords.reduce(
                (total, word) => total + word.correctCount,
                0,
            );
            const totalWrongCount = levelWords.reduce(
                (total, word) => total + word.wrongCount,
                0,
            );
            const totalUnknownCount = levelWords.reduce(
                (total, word) => total + word.unknownCount,
                0,
            );
            const masteredCount = levelWords.filter((word) => word.isMastered).length;

            return {
                level,
                words: levelWords,
                totalWords: levelWords.length,
                studiedCount,
                totalCorrectCount,
                totalWrongCount,
                totalUnknownCount,
                masteredCount,
            };
        });

    return {
        totalWords: words.length,
        studiedCount: words.filter((word) => word.isStudied).length,
        totalCorrectCount: words.reduce((total, word) => total + word.correctCount, 0),
        totalWrongCount: words.reduce((total, word) => total + word.wrongCount, 0),
        totalUnknownCount: words.reduce((total, word) => total + word.unknownCount, 0),
        masteredCount: words.filter((word) => word.isMastered).length,
        activeLevelCount: levels.filter((level) => level.studiedCount > 0).length,
        levels,
    };
};

export const recordRoundResult = (
    cards,
    item,
    wasCorrect,
    reviewedAt = new Date(),
    options = {},
) => {
    if (!item) {
        return cards;
    }

    const current = getCardProgress(cards, item.id);
    const currentBox = current?.box ?? 0;
    const reviewedAtTimestamp =
        reviewedAt instanceof Date ? reviewedAt.getTime() : new Date(reviewedAt).getTime();
    const lastReviewedAt = new Date(reviewedAtTimestamp).toISOString();

    if (wasCorrect) {
        const nextBox = Math.min(currentBox + 1, MAX_BOX);
        const delay = BOX_REVIEW_DELAYS[currentBox] || BOX_REVIEW_DELAYS[MAX_BOX];

        return {
            ...cards,
            [item.id]: {
                box: nextBox,
                lastResult: 'correct',
                correctCount: (current?.correctCount || 0) + 1,
                wrongCount: current?.wrongCount || 0,
                unknownCount: current?.unknownCount || 0,
                consecutiveCorrect: (current?.consecutiveCorrect || 0) + 1,
                lastReviewedAt,
                nextReviewAt: new Date(reviewedAtTimestamp + delay).toISOString(),
            },
        };
    }

    const countAsWrong = options.countAsWrong !== false;

    return {
        ...cards,
        [item.id]: {
            box: 0,
            lastResult: 'wrong',
            correctCount: current?.correctCount || 0,
            wrongCount: (current?.wrongCount || 0) + (countAsWrong ? 1 : 0),
            unknownCount: (current?.unknownCount || 0) + (countAsWrong ? 0 : 1),
            consecutiveCorrect: 0,
            lastReviewedAt,
            nextReviewAt: new Date(reviewedAtTimestamp + FAILED_CARD_DELAY).toISOString(),
        },
    };
};

export const buildRound = (items, preferredQuestion = null, answerMode = 'hanzi') => {
    if (!items || items.length < OPTION_COUNT) {
        return null;
    }

    const question = preferredQuestion || items[Math.floor(Math.random() * items.length)];

    if (!question) {
        return null;
    }

    const sameLengthDistractors = shuffle(
        items.filter(
            (item) => item.id !== question.id && item.hanzi.length === question.hanzi.length,
        ),
    );
    const fallbackDistractors = shuffle(items.filter((item) => item.id !== question.id));
    const distractors = pickUniqueDistractors(
        uniqueById([...sameLengthDistractors, ...fallbackDistractors]),
        question,
        answerMode,
    );

    if (distractors.length < OPTION_COUNT - 1) {
        return null;
    }

    return {
        question,
        options: shuffle([question, ...distractors]),
    };
};
