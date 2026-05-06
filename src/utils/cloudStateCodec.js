import { normalizeAppState } from './appState';

const CLOUD_STATE_CODEC_VERSION = 2;
const CORRECT_RESULT_FLAG = 1;

const toIsoString = (value) => {
    if (Number.isFinite(value)) {
        return new Date(value).toISOString();
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
};

const encodeDate = (value) => {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
};

const encodeCardProgress = (entry) => [
    entry.box || 0,
    entry.lastResult === 'correct' ? CORRECT_RESULT_FLAG : 0,
    entry.correctCount || 0,
    entry.wrongCount || 0,
    entry.unknownCount || 0,
    entry.consecutiveCorrect || 0,
    encodeDate(entry.lastReviewedAt),
    encodeDate(entry.nextReviewAt),
];

const decodeCardProgress = (entry) => {
    if (!Array.isArray(entry)) {
        return null;
    }

    const lastReviewedAt = toIsoString(entry[6]);
    const nextReviewAt = toIsoString(entry[7]);

    if (!lastReviewedAt || !nextReviewAt) {
        return null;
    }

    return {
        box: Number.isFinite(entry[0]) ? entry[0] : 0,
        lastResult: entry[1] === CORRECT_RESULT_FLAG ? 'correct' : 'wrong',
        correctCount: Number.isFinite(entry[2]) ? entry[2] : 0,
        wrongCount: Number.isFinite(entry[3]) ? entry[3] : 0,
        unknownCount: Number.isFinite(entry[4]) ? entry[4] : 0,
        consecutiveCorrect: Number.isFinite(entry[5]) ? entry[5] : 0,
        lastReviewedAt,
        nextReviewAt,
    };
};

export const isCompactCloudState = (value) =>
    Boolean(value && typeof value === 'object' && value.v === CLOUD_STATE_CODEC_VERSION && value.p);

export const decodeCloudState = (value) => {
    if (!isCompactCloudState(value)) {
        return value;
    }

    const cards = Object.fromEntries(
        Object.entries(value.p?.c || {}).flatMap(([cardId, entry]) => {
            const decodedEntry = decodeCardProgress(entry);
            return decodedEntry ? [[cardId, decodedEntry]] : [];
        }),
    );

    return {
        version: 1,
        settings: value.s || {},
        progress: {
            version: value.p?.v || 1,
            profileId: value.p?.i || 'default',
            cards,
            updatedAt: toIsoString(value.p?.u) || toIsoString(value.u) || new Date().toISOString(),
        },
        updatedAt: toIsoString(value.u) || toIsoString(value.p?.u) || new Date().toISOString(),
    };
};

export const encodeCloudState = (value) => {
    const normalizedState = normalizeAppState(decodeCloudState(value));
    const cards = Object.fromEntries(
        Object.entries(normalizedState.progress?.cards || {}).map(([cardId, entry]) => [
            cardId,
            encodeCardProgress(entry),
        ]),
    );

    return {
        v: CLOUD_STATE_CODEC_VERSION,
        s: normalizedState.settings,
        p: {
            v: normalizedState.progress?.version || 1,
            i: normalizedState.progress?.profileId || 'default',
            u: encodeDate(normalizedState.progress?.updatedAt),
            c: cards,
        },
        u: encodeDate(normalizedState.updatedAt),
    };
};
