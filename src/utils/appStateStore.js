import AsyncStorage from '@react-native-async-storage/async-storage';

import { createAppState, normalizeAppState } from './appState';
import {
    createPracticeProgress,
    DEFAULT_PROFILE_ID,
    normalizePracticeProgress,
} from './practice';

const APP_STATE_STORAGE_PREFIX = 'zou-ba:app-state:v1';
const SESSION_STORAGE_KEY = 'zou-ba:session:v1';
const LEGACY_PROGRESS_STORAGE_PREFIX = 'practice-progress:v2:pdf-english';

const getAppStateStorageKey = (userId) =>
    userId ? `${APP_STATE_STORAGE_PREFIX}:user:${userId}` : `${APP_STATE_STORAGE_PREFIX}:guest`;

const getLegacyProgressStorageKey = (profileId = DEFAULT_PROFILE_ID) =>
    `${LEGACY_PROGRESS_STORAGE_PREFIX}:${profileId}`;

const parseJson = (value) => {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return null;
    }
};

export const loadStoredAppState = async (userId = null) => {
    try {
        const storedValue = await AsyncStorage.getItem(getAppStateStorageKey(userId));
        const parsedValue = parseJson(storedValue);

        if (parsedValue) {
            return normalizeAppState(parsedValue);
        }

        if (userId) {
            return createAppState();
        }

        const legacyProgressValue = await AsyncStorage.getItem(
            getLegacyProgressStorageKey(DEFAULT_PROFILE_ID),
        );
        const parsedLegacyProgress = parseJson(legacyProgressValue);

        if (!parsedLegacyProgress) {
            return createAppState();
        }

        const migratedProgress = normalizePracticeProgress(
            parsedLegacyProgress,
            DEFAULT_PROFILE_ID,
        );

        return createAppState({
            progress: createPracticeProgress(
                DEFAULT_PROFILE_ID,
                migratedProgress.cards,
                migratedProgress.updatedAt,
            ),
            updatedAt: migratedProgress.updatedAt,
        });
    } catch (error) {
        return createAppState();
    }
};

export const saveStoredAppState = async (userId = null, appState) => {
    const normalizedState = normalizeAppState(appState);

    await AsyncStorage.setItem(
        getAppStateStorageKey(userId),
        JSON.stringify(normalizedState),
    );

    return normalizedState;
};

export const loadStoredSession = async () => {
    try {
        const storedValue = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        const parsedValue = parseJson(storedValue);

        if (!parsedValue?.token || !parsedValue?.user?.id || !parsedValue?.user?.username) {
            return null;
        }

        return {
            token: parsedValue.token,
            expiresAt: parsedValue.expiresAt || null,
            user: {
                id: parsedValue.user.id,
                username: parsedValue.user.username,
            },
        };
    } catch (error) {
        return null;
    }
};

export const saveStoredSession = async (session) => {
    if (!session?.token || !session?.user?.id || !session?.user?.username) {
        return null;
    }

    const normalizedSession = {
        token: session.token,
        expiresAt: session.expiresAt || null,
        user: {
            id: session.user.id,
            username: session.user.username,
        },
    };

    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalizedSession));

    return normalizedSession;
};

export const clearStoredSession = async () => {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
};
