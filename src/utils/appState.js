import { DEFAULT_SETTINGS, normalizeSettings } from '../constants/defaultSettings';
import {
    createPracticeProgress,
    DEFAULT_PROFILE_ID,
    normalizePracticeProgress,
} from './practice';

export const APP_STATE_VERSION = 1;

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

const getNumericCount = (value) =>
    Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

export const summarizeAppStateProgress = (state) => {
    const cards = state?.progress?.cards || {};

    return Object.values(cards).reduce(
        (summary, entry) => {
            if (!entry || typeof entry !== 'object') {
                return summary;
            }

            const correctCount = getNumericCount(entry.correctCount);
            const wrongCount = getNumericCount(entry.wrongCount);

            return {
                attemptCount: summary.attemptCount + correctCount + wrongCount,
                studiedCount: summary.studiedCount + 1,
                correctCount: summary.correctCount + correctCount,
                wrongCount: summary.wrongCount + wrongCount,
            };
        },
        {
            attemptCount: 0,
            studiedCount: 0,
            correctCount: 0,
            wrongCount: 0,
        },
    );
};

export const createAppState = ({
    settings = DEFAULT_SETTINGS,
    progress = createPracticeProgress(DEFAULT_PROFILE_ID),
    updatedAt = new Date().toISOString(),
} = {}) => ({
    version: APP_STATE_VERSION,
    settings: normalizeSettings(settings),
    progress: normalizePracticeProgress(progress, DEFAULT_PROFILE_ID),
    updatedAt: getValidIsoString(updatedAt) || new Date().toISOString(),
});

export const normalizeAppState = (value) => {
    if (!value || typeof value !== 'object') {
        return createAppState();
    }

    const normalizedProgress = normalizePracticeProgress(value.progress, DEFAULT_PROFILE_ID);

    return createAppState({
        settings: value.settings,
        progress: normalizedProgress,
        updatedAt:
            getValidIsoString(value.updatedAt) ||
            normalizedProgress.updatedAt ||
            new Date().toISOString(),
    });
};

export const withUpdatedSettings = (currentState, settingsPatch) => {
    const updatedAt = new Date().toISOString();

    return createAppState({
        settings: {
            ...normalizeSettings(currentState?.settings),
            ...settingsPatch,
        },
        progress: normalizePracticeProgress(currentState?.progress, DEFAULT_PROFILE_ID),
        updatedAt,
    });
};

export const withUpdatedProgress = (currentState, nextProgress) => {
    const updatedAt = new Date().toISOString();
    const normalizedProgress = normalizePracticeProgress(nextProgress, DEFAULT_PROFILE_ID);

    return createAppState({
        settings: normalizeSettings(currentState?.settings),
        progress: createPracticeProgress(
            DEFAULT_PROFILE_ID,
            normalizedProgress.cards,
            updatedAt,
        ),
        updatedAt,
    });
};

export const compareAppStateFreshness = (leftState, rightState) => {
    const leftProgress = summarizeAppStateProgress(leftState);
    const rightProgress = summarizeAppStateProgress(rightState);

    if (leftProgress.attemptCount !== rightProgress.attemptCount) {
        return leftProgress.attemptCount > rightProgress.attemptCount ? 1 : -1;
    }

    if (leftProgress.studiedCount !== rightProgress.studiedCount) {
        return leftProgress.studiedCount > rightProgress.studiedCount ? 1 : -1;
    }

    const leftTimestamp = toTimestamp(leftState?.updatedAt) ?? 0;
    const rightTimestamp = toTimestamp(rightState?.updatedAt) ?? 0;

    if (leftTimestamp === rightTimestamp) {
        return 0;
    }

    return leftTimestamp > rightTimestamp ? 1 : -1;
};

export const isPristineAppState = (value) => {
    const normalizedState = normalizeAppState(value);
    const normalizedDefaultSettings = normalizeSettings(DEFAULT_SETTINGS);
    const cardCount = Object.keys(normalizedState.progress?.cards || {}).length;

    return (
        cardCount === 0 &&
        JSON.stringify(normalizedState.settings) === JSON.stringify(normalizedDefaultSettings)
    );
};

export const resolveCloudStateConflict = (localState, remoteState) => {
    const normalizedLocal = localState ? normalizeAppState(localState) : null;
    const normalizedRemote = remoteState ? normalizeAppState(remoteState) : null;

    if (!normalizedLocal) {
        return normalizedRemote || createAppState();
    }

    if (!normalizedRemote) {
        return normalizedLocal;
    }

    const localIsPristine = isPristineAppState(normalizedLocal);
    const remoteIsPristine = isPristineAppState(normalizedRemote);

    if (localIsPristine && !remoteIsPristine) {
        return normalizedRemote;
    }

    if (!localIsPristine && remoteIsPristine) {
        return normalizedLocal;
    }

    return compareAppStateFreshness(normalizedLocal, normalizedRemote) >= 0
        ? normalizedLocal
        : normalizedRemote;
};

export const pickNewerAppState = (leftState, rightState) => {
    const normalizedLeft = leftState ? normalizeAppState(leftState) : null;
    const normalizedRight = rightState ? normalizeAppState(rightState) : null;

    if (!normalizedLeft) {
        return normalizedRight || createAppState();
    }

    if (!normalizedRight) {
        return normalizedLeft;
    }

    return compareAppStateFreshness(normalizedLeft, normalizedRight) >= 0
        ? normalizedLeft
        : normalizedRight;
};
