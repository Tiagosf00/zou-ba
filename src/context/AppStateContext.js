import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import { DEFAULT_SETTINGS } from '../constants/defaultSettings';
import {
    compareAppStateFreshness,
    createAppState,
    normalizeAppState,
    pickNewerAppState,
    resolveCloudStateConflict,
    withUpdatedProgress,
    withUpdatedSettings,
} from '../utils/appState';
import {
    clearStoredSession,
    loadStoredAppState,
    loadStoredSession,
    saveStoredAppState,
    saveStoredSession,
} from '../utils/appStateStore';
import {
    fetchSession,
    isCloudConfigured,
    logIn as logInRequest,
    logOut as logOutRequest,
    saveCloudState,
    signUp as signUpRequest,
} from '../utils/cloudApi';

const AppStateContext = createContext(null);

const DEFAULT_SYNC_STATE = {
    kind: isCloudConfigured ? 'guest' : 'disabled',
    message: isCloudConfigured
        ? 'Sign in to back up your progress and settings.'
        : 'Cloud backup is not available in this build.',
    lastSyncedAt: null,
};

const normalizeSession = (session) => {
    if (!session?.token || !session?.user?.id || !session?.user?.username) {
        return null;
    }

    return {
        token: session.token,
        expiresAt: session.expiresAt || null,
        user: {
            id: session.user.id,
            username: session.user.username,
        },
    };
};

export const AppStateProvider = ({ children }) => {
    const [appState, setAppState] = useState(() =>
        createAppState({
            settings: DEFAULT_SETTINGS,
        }),
    );
    const [session, setSession] = useState(null);
    const [storageUserId, setStorageUserId] = useState(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [syncState, setSyncState] = useState(DEFAULT_SYNC_STATE);
    const [authAction, setAuthAction] = useState('idle');
    const appStateRef = useRef(appState);
    const sessionRef = useRef(session);
    const syncTimeoutRef = useRef(null);
    const lastSyncedUpdatedAtRef = useRef(null);

    useEffect(() => {
        appStateRef.current = appState;
    }, [appState]);

    useEffect(() => {
        sessionRef.current = session;
    }, [session]);

    const persistStateLocally = useCallback(async (nextUserId, nextState) => {
        await saveStoredAppState(nextUserId, nextState);
    }, []);

    const expireSession = useCallback(
        async (expiredSession, cachedState, message = 'Your session expired. Please sign in again.') => {
            if (expiredSession?.user?.id) {
                await persistStateLocally(expiredSession.user.id, cachedState);
            }

            await clearStoredSession();

            const guestState = await loadStoredAppState();

            setSession(null);
            setStorageUserId(null);
            setAppState(guestState);
            lastSyncedUpdatedAtRef.current = null;
            setSyncState({
                kind: 'error',
                message,
                lastSyncedAt: null,
            });
        },
        [persistStateLocally],
    );

    const syncStateNow = useCallback(
        async (
            stateToSync = appStateRef.current,
            sessionToUse = sessionRef.current,
            { force = false, message = 'Syncing your progress to the cloud...' } = {},
        ) => {
            const normalizedSession = normalizeSession(sessionToUse);
            const normalizedState = normalizeAppState(stateToSync);

            if (!normalizedSession || !isCloudConfigured) {
                return normalizedState;
            }

            if (!force && lastSyncedUpdatedAtRef.current === normalizedState.updatedAt) {
                return normalizedState;
            }

            setSyncState({
                kind: 'syncing',
                message,
                lastSyncedAt: lastSyncedUpdatedAtRef.current,
            });

            try {
                const response = await saveCloudState(normalizedSession.token, normalizedState);
                const savedState = normalizeAppState(response?.state || normalizedState);

                lastSyncedUpdatedAtRef.current = savedState.updatedAt;
                await persistStateLocally(normalizedSession.user.id, savedState);

                setAppState((currentState) =>
                    compareAppStateFreshness(currentState, savedState) > 0
                        ? currentState
                        : savedState,
                );
                setSyncState({
                    kind: 'synced',
                    message: `Cloud backup up to date for ${normalizedSession.user.username}.`,
                    lastSyncedAt: savedState.updatedAt,
                });

                return savedState;
            } catch (error) {
                if (error?.status === 401) {
                    await expireSession(normalizedSession, normalizedState);
                    return normalizedState;
                }

                setSyncState({
                    kind: 'error',
                    message: error.message,
                    lastSyncedAt: lastSyncedUpdatedAtRef.current,
                });
                throw error;
            }
        },
        [expireSession, persistStateLocally],
    );

    const reconcileAuthenticatedState = useCallback(
        async (nextSession, remoteState, localCandidate) => {
            const normalizedSession = normalizeSession(nextSession);
            const normalizedLocalState = normalizeAppState(localCandidate);
            const normalizedRemoteState = remoteState ? normalizeAppState(remoteState) : null;
            const resolvedState = resolveCloudStateConflict(
                normalizedLocalState,
                normalizedRemoteState,
            );

            setSession(normalizedSession);
            setStorageUserId(normalizedSession.user.id);
            setAppState(resolvedState);

            if (
                normalizedRemoteState &&
                compareAppStateFreshness(normalizedRemoteState, resolvedState) === 0
            ) {
                lastSyncedUpdatedAtRef.current = normalizedRemoteState.updatedAt;
                await persistStateLocally(normalizedSession.user.id, normalizedRemoteState);
                setSyncState({
                    kind: 'synced',
                    message: `Cloud backup restored for ${normalizedSession.user.username}.`,
                    lastSyncedAt: normalizedRemoteState.updatedAt,
                });
                return normalizedRemoteState;
            }

            await persistStateLocally(normalizedSession.user.id, resolvedState);
            return syncStateNow(resolvedState, normalizedSession, {
                force: true,
                message: `Finishing cloud sync for ${normalizedSession.user.username}...`,
            });
        },
        [persistStateLocally, syncStateNow],
    );

    useEffect(() => {
        let isActive = true;

        const hydrateApp = async () => {
            const storedSession = normalizeSession(await loadStoredSession());

            if (!storedSession) {
                const guestState = await loadStoredAppState();

                if (!isActive) {
                    return;
                }

                setAppState(guestState);
                setStorageUserId(null);
                setIsHydrated(true);
                setSyncState(DEFAULT_SYNC_STATE);
                return;
            }

            const cachedUserState = await loadStoredAppState(storedSession.user.id);
            const guestState = await loadStoredAppState();
            const localCandidate = pickNewerAppState(cachedUserState, guestState);

            if (!isActive) {
                return;
            }

            setSession(storedSession);
            setStorageUserId(storedSession.user.id);
            setAppState(localCandidate);
            setIsHydrated(true);

            if (!isCloudConfigured) {
                setSyncState({
                    kind: 'disabled',
                    message:
                        'Cloud backup is not available in this build.',
                    lastSyncedAt: null,
                });
                return;
            }

            setSyncState({
                kind: 'syncing',
                message: `Restoring ${storedSession.user.username}'s cloud backup...`,
                lastSyncedAt: null,
            });

            try {
                const sessionPayload = await fetchSession(storedSession.token);

                if (!isActive) {
                    return;
                }

                const refreshedSession = normalizeSession({
                    token: storedSession.token,
                    expiresAt: sessionPayload.expiresAt,
                    user: sessionPayload.user,
                });

                await saveStoredSession(refreshedSession);
                await reconcileAuthenticatedState(
                    refreshedSession,
                    sessionPayload.state,
                    localCandidate,
                );
            } catch (error) {
                if (!isActive) {
                    return;
                }

                await expireSession(
                    storedSession,
                    localCandidate,
                    error?.status === 401
                        ? 'Your saved session expired. Please sign in again.'
                        : 'Unable to restore the cloud session right now.',
                );
            }
        };

        void hydrateApp();

        return () => {
            isActive = false;
        };
    }, [expireSession, reconcileAuthenticatedState]);

    useEffect(() => {
        if (!isHydrated) {
            return undefined;
        }

        void persistStateLocally(storageUserId, appState);

        return undefined;
    }, [appState, isHydrated, persistStateLocally, storageUserId]);

    useEffect(() => {
        if (!isHydrated || !isCloudConfigured) {
            return undefined;
        }

        if (!session?.token || storageUserId !== session.user.id) {
            return undefined;
        }

        if (lastSyncedUpdatedAtRef.current === appState.updatedAt) {
            return undefined;
        }

        syncTimeoutRef.current = setTimeout(() => {
            void syncStateNow(appState, session);
        }, 900);

        return () => {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }
        };
    }, [appState, isHydrated, session, storageUserId, syncStateNow]);

    const updateSettings = useCallback((settingsPatch) => {
        setAppState((currentState) => withUpdatedSettings(currentState, settingsPatch));
    }, []);

    const updateProgress = useCallback((nextProgress) => {
        setAppState((currentState) =>
            withUpdatedProgress(
                currentState,
                typeof nextProgress === 'function'
                    ? nextProgress(currentState.progress)
                    : nextProgress,
            ),
        );
    }, []);

    const signUp = useCallback(async (username, password) => {
        setAuthAction('signing-up');

        try {
            const response = await signUpRequest(username, password);
            const nextSession = normalizeSession(response);

            await saveStoredSession(nextSession);
            await reconcileAuthenticatedState(
                nextSession,
                response.state,
                pickNewerAppState(
                    appStateRef.current,
                    await loadStoredAppState(nextSession.user.id),
                ),
            );

            return nextSession;
        } finally {
            setAuthAction('idle');
        }
    }, [reconcileAuthenticatedState]);

    const logIn = useCallback(async (username, password) => {
        setAuthAction('logging-in');

        try {
            const response = await logInRequest(username, password);
            const nextSession = normalizeSession(response);

            await saveStoredSession(nextSession);
            await reconcileAuthenticatedState(
                nextSession,
                response.state,
                pickNewerAppState(
                    appStateRef.current,
                    await loadStoredAppState(nextSession.user.id),
                ),
            );

            return nextSession;
        } finally {
            setAuthAction('idle');
        }
    }, [reconcileAuthenticatedState]);

    const logOut = useCallback(async () => {
        const currentSession = normalizeSession(sessionRef.current);
        const currentState = normalizeAppState(appStateRef.current);

        setAuthAction('logging-out');

        try {
            if (currentSession) {
                await persistStateLocally(currentSession.user.id, currentState);

                if (isCloudConfigured) {
                    try {
                        await logOutRequest(currentSession.token);
                    } catch (error) {
                        // Keep logout resilient even if the network call fails.
                    }
                }
            }

            await clearStoredSession();

            const guestState = await loadStoredAppState();

            setSession(null);
            setStorageUserId(null);
            setAppState(guestState);
            lastSyncedUpdatedAtRef.current = null;
            setSyncState(DEFAULT_SYNC_STATE);
        } finally {
            setAuthAction('idle');
        }
    }, [persistStateLocally]);

    const syncNow = useCallback(async () => syncStateNow(), [syncStateNow]);

    const value = useMemo(
        () => ({
            settings: appState.settings,
            progress: appState.progress,
            appState,
            isHydrated,
            updateSettings,
            updateProgress,
            auth: {
                session,
                isAuthenticated: Boolean(session?.token),
                action: authAction,
            },
            cloud: {
                isConfigured: isCloudConfigured,
                syncState,
                signUp,
                logIn,
                logOut,
                syncNow,
            },
        }),
        [
            appState,
            authAction,
            isHydrated,
            logIn,
            logOut,
            session,
            signUp,
            syncNow,
            syncState,
            updateProgress,
            updateSettings,
        ],
    );

    return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = () => {
    const context = useContext(AppStateContext);

    if (!context) {
        throw new Error('useAppState must be used within an AppStateProvider.');
    }

    return context;
};
