import { normalizeAppState } from './appState';
import { decodeCloudState, encodeCloudState } from './cloudStateCodec';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');
const STATE_ENCODING_HEADER = 'X-Zou-Ba-State-Encoding';
const STATE_ENCODING_VALUE = 'compact-v2';

export const isCloudConfigured = Boolean(API_BASE_URL);

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

const request = async (path, { body, headers, method = 'GET', token } = {}) => {
    if (!isCloudConfigured) {
        throw new ApiError(
            'Cloud sync is not configured yet. Set EXPO_PUBLIC_API_BASE_URL first.',
            0,
        );
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: {
            Accept: 'application/json',
            [STATE_ENCODING_HEADER]: STATE_ENCODING_VALUE,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

    let payload = null;

    try {
        payload = await response.json();
    } catch (error) {
        payload = null;
    }

    if (!response.ok) {
        throw new ApiError(
            payload?.error || `Request failed with status ${response.status}.`,
            response.status,
        );
    }

    return payload;
};

const normalizeSessionResponse = (payload) => ({
    token: payload.session?.token || payload.token,
    expiresAt: payload.session?.expiresAt || payload.expiresAt || null,
    user: payload.user,
    state: payload.state ? normalizeAppState(decodeCloudState(payload.state)) : null,
});

export const signUp = async (username, password) =>
    normalizeSessionResponse(
        await request('/auth/signup', {
            method: 'POST',
            body: { username, password },
        }),
    );

export const logIn = async (username, password) =>
    normalizeSessionResponse(
        await request('/auth/login', {
            method: 'POST',
            body: { username, password },
        }),
    );

export const fetchSession = async (token) =>
    normalizeSessionResponse(
        await request('/auth/session', {
            token,
        }),
    );

export const logOut = async (token) =>
    request('/auth/logout', {
        method: 'POST',
        token,
    });

export const saveCloudState = async (token, state) =>
    request('/state', {
        method: 'PUT',
        token,
        body: {
            state: encodeCloudState(state),
        },
    });

export const fetchLeaderboard = async (token) =>
    request('/leaderboard', {
        token,
    });
