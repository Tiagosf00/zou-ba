import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadStoredAppState, saveStoredAppState } from './appStateStore';
import {
    createPracticeProgress,
    DEFAULT_PROFILE_ID,
    normalizePracticeProgress,
} from './practice';

const STORAGE_PREFIX = 'practice-progress:v2:pdf-english';

const getStorageKey = (profileId = DEFAULT_PROFILE_ID) => `${STORAGE_PREFIX}:${profileId}`;

export const loadProgress = async (profileId = DEFAULT_PROFILE_ID) => {
    try {
        const appState = await loadStoredAppState();

        if (appState?.progress) {
            return normalizePracticeProgress(appState.progress, profileId);
        }

        const storedValue = await AsyncStorage.getItem(getStorageKey(profileId));

        if (!storedValue) {
            return createPracticeProgress(profileId);
        }

        return normalizePracticeProgress(JSON.parse(storedValue), profileId);
    } catch (error) {
        return createPracticeProgress(profileId);
    }
};

export const saveProgress = async (profileId = DEFAULT_PROFILE_ID, data) => {
    const normalizedProgress = normalizePracticeProgress(data, profileId);
    const nextProgress = createPracticeProgress(
        profileId,
        normalizedProgress.cards,
        new Date().toISOString(),
    );

    const appState = await loadStoredAppState();
    await saveStoredAppState(null, {
        ...appState,
        progress: nextProgress,
        updatedAt: nextProgress.updatedAt,
    });
    await AsyncStorage.setItem(getStorageKey(profileId), JSON.stringify(nextProgress));

    return nextProgress;
};

export const clearProgress = async (profileId = DEFAULT_PROFILE_ID) => {
    const appState = await loadStoredAppState();
    await saveStoredAppState(null, {
        ...appState,
        progress: createPracticeProgress(profileId),
        updatedAt: new Date().toISOString(),
    });
    await AsyncStorage.removeItem(getStorageKey(profileId));
};
