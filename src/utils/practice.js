const OPTION_COUNT = 6;
const REVIEW_INTERVALS = [4, 8, 14, 24, 40];
const FAILED_CARD_DELAY = 2;

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

const createCardProgress = () => ({
    dueStep: 0,
    lastResult: 'new',
    lastSeenStep: -1,
    level: 0,
    seenCount: 0,
});

const getCardProgress = (scheduler, itemId) => scheduler?.[itemId] || createCardProgress();

const getCardPriority = (entry, itemId, step, recentIds) => {
    const recentPenalty =
        recentIds.includes(itemId) && entry.lastResult !== 'wrong' ? 3 : 0;
    const overdueBoost = Math.max(0, step - entry.dueStep) * 0.35;
    const wrongAnswerBoost = entry.lastResult === 'wrong' ? 6 : 0;
    const newCardBoost = entry.seenCount === 0 ? 5 : 0;
    const masteryPenalty = entry.level;
    const exposurePenalty = entry.seenCount * 0.15;

    return (
        wrongAnswerBoost +
        newCardBoost +
        overdueBoost -
        recentPenalty -
        masteryPenalty -
        exposurePenalty
    );
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

export const createPracticeScheduler = (items) =>
    Object.fromEntries((items || []).map((item) => [item.id, createCardProgress()]));

export const pickNextQuestion = (items, scheduler, step, recentIds = []) => {
    if (!items || items.length === 0) {
        return null;
    }

    const dueItems = items.filter((item) => getCardProgress(scheduler, item.id).dueStep <= step);
    const pool = dueItems.length > 0 ? dueItems : items;

    return shuffle(pool)
        .sort((firstItem, secondItem) => {
            const firstProgress = getCardProgress(scheduler, firstItem.id);
            const secondProgress = getCardProgress(scheduler, secondItem.id);

            if (dueItems.length === 0 && firstProgress.dueStep !== secondProgress.dueStep) {
                return firstProgress.dueStep - secondProgress.dueStep;
            }

            const priorityDifference =
                getCardPriority(secondProgress, secondItem.id, step, recentIds) -
                getCardPriority(firstProgress, firstItem.id, step, recentIds);

            if (priorityDifference !== 0) {
                return priorityDifference;
            }

            return firstProgress.lastSeenStep - secondProgress.lastSeenStep;
        })[0];
};

export const recordRoundResult = (scheduler, item, wasCorrect, step) => {
    if (!item) {
        return scheduler;
    }

    const current = getCardProgress(scheduler, item.id);
    const nextLevel = wasCorrect ? Math.min(current.level + 1, REVIEW_INTERVALS.length) : 0;
    const nextDueStep = wasCorrect
        ? step + REVIEW_INTERVALS[nextLevel - 1]
        : step + FAILED_CARD_DELAY;

    return {
        ...scheduler,
        [item.id]: {
            dueStep: nextDueStep,
            lastResult: wasCorrect ? 'correct' : 'wrong',
            lastSeenStep: step,
            level: nextLevel,
            seenCount: current.seenCount + 1,
        },
    };
};

export const buildRound = (items, preferredQuestion = null) => {
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
    const distractors = uniqueById([...sameLengthDistractors, ...fallbackDistractors]).slice(
        0,
        OPTION_COUNT - 1,
    );

    if (distractors.length < OPTION_COUNT - 1) {
        return null;
    }

    return {
        question,
        options: shuffle([question, ...distractors]),
    };
};
