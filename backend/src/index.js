import hskData from '../../assets/hsk_1_6_pdf_dataset_english.json' with { type: 'json' };

const JSON_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
};

// Workers supports PBKDF2, but very high iteration counts can throw at runtime.
const PASSWORD_ITERATIONS = 100000;
const PASSWORD_KEY_LENGTH = 32;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const AUTH_WINDOW_MS = 1000 * 60 * 15;
const AUTH_ATTEMPT_LIMIT = 10;
const MAX_STATE_BYTES = 1024 * 1024;
const DEFAULT_ALLOWED_ORIGINS = [
    'https://tiagosf00.github.io',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
];

const encoder = new TextEncoder();
const HSK_LEVEL_BY_CARD_ID = Object.fromEntries(
    hskData.map((item) => [String(item.id), Number(item.level) || 1]),
);

const getNowIso = () => new Date().toISOString();

const parseJsonSafely = async (request) => {
    try {
        return await request.json();
    } catch (error) {
        return null;
    }
};

const normalizeUsername = (value) => String(value || '').trim().toLowerCase();

export const validateUsername = (value) => {
    const username = normalizeUsername(value);

    if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
        return {
            ok: false,
            error: 'Username must be 3-24 characters using lowercase letters, numbers, underscores, or dashes.',
        };
    }

    return {
        ok: true,
        username,
    };
};

export const validatePassword = (value) => {
    const password = String(value || '');

    if (password.length < 6 || password.length > 128) {
        return {
            ok: false,
            error: 'Password must be between 6 and 128 characters.',
        };
    }

    return {
        ok: true,
        password,
    };
};

const bytesToBase64 = (bytes) => {
    let binary = '';

    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary);
};

const base64ToBytes = (value) => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
};

const toBase64Url = (bytes) =>
    bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const constantTimeEqual = (left, right) => {
    if (left.length !== right.length) {
        return false;
    }

    let result = 0;

    for (let index = 0; index < left.length; index += 1) {
        result |= left[index] ^ right[index];
    }

    return result === 0;
};

const sha256Base64 = async (value) => {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
    return bytesToBase64(new Uint8Array(digest));
};

export const hashPassword = async (
    password,
    {
        iterations = PASSWORD_ITERATIONS,
        salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16))),
    } = {},
) => {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: base64ToBytes(salt),
            iterations,
            hash: 'SHA-256',
        },
        keyMaterial,
        PASSWORD_KEY_LENGTH * 8,
    );

    return {
        iterations,
        salt,
        hash: bytesToBase64(new Uint8Array(derivedBits)),
    };
};

export const verifyPassword = async (password, storedHash, storedSalt, storedIterations) => {
    const candidate = await hashPassword(password, {
        iterations: storedIterations,
        salt: storedSalt,
    });

    return constantTimeEqual(base64ToBytes(candidate.hash), base64ToBytes(storedHash));
};

export const normalizeStatePayload = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {
            ok: false,
            error: 'State payload must be a JSON object.',
        };
    }

    const serialized = JSON.stringify(value);

    if (encoder.encode(serialized).length > MAX_STATE_BYTES) {
        return {
            ok: false,
            error: 'State payload is too large to store.',
        };
    }

    return {
        ok: true,
        serialized,
        state: value,
    };
};

export const getCardLevelWeight = (cardId) => {
    const level = HSK_LEVEL_BY_CARD_ID[String(cardId)];
    return Number.isInteger(level) && level >= 1 ? level : 1;
};

export const calculateLeaderboardScore = (state) => {
    const cards =
        state && typeof state === 'object' && !Array.isArray(state)
            ? state.progress?.cards || {}
            : {};

    return Object.entries(cards).reduce(
        (summary, [cardId, entry]) => {
            if (!entry || typeof entry !== 'object') {
                return summary;
            }

            const weight = getCardLevelWeight(cardId);
            const correctCount = Number.isFinite(entry.correctCount) ? entry.correctCount : 0;
            const wrongCount = Number.isFinite(entry.wrongCount) ? entry.wrongCount : 0;

            return {
                score: summary.score + (correctCount - wrongCount) * weight,
                correctCount: summary.correctCount + correctCount,
                wrongCount: summary.wrongCount + wrongCount,
                studiedCount: summary.studiedCount + 1,
            };
        },
        {
            score: 0,
            correctCount: 0,
            wrongCount: 0,
            studiedCount: 0,
        },
    );
};

const getAllowedOrigins = (env) =>
    String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

const createCorsHeaders = (request, env) => {
    const origin = request.headers.get('Origin');
    const allowedOrigins = getAllowedOrigins(env);
    const allowOrigin =
        origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*';

    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization,Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };
};

const jsonResponse = (request, env, body, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            ...JSON_HEADERS,
            ...createCorsHeaders(request, env),
        },
    });

const errorResponse = (request, env, message, status = 400) =>
    jsonResponse(request, env, { error: message }, status);

const getClientIp = (request) => {
    const cfIp = request.headers.get('CF-Connecting-IP');

    if (cfIp) {
        return cfIp;
    }

    const forwardedFor = request.headers.get('X-Forwarded-For');
    return forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
};

const assertRateLimit = async (env, request, action, username) => {
    const nowIso = getNowIso();
    const windowStartIso = new Date(Date.now() - AUTH_WINDOW_MS).toISOString();
    const identifier = `${action}:${getClientIp(request)}:${normalizeUsername(username) || 'anonymous'}`;

    const result = await env.DB.prepare(
        `
            SELECT COUNT(*) AS attempt_count
            FROM auth_attempts
            WHERE identifier = ?1 AND created_at >= ?2
        `,
    )
        .bind(identifier, windowStartIso)
        .first();

    const attemptCount = Number(result?.attempt_count || 0);

    if (attemptCount >= AUTH_ATTEMPT_LIMIT) {
        throw new Error('Too many authentication attempts. Please wait a few minutes and try again.');
    }

    await env.DB.prepare(
        `
            INSERT INTO auth_attempts (id, action, identifier, created_at)
            VALUES (?1, ?2, ?3, ?4)
        `,
    )
        .bind(crypto.randomUUID(), action, identifier, nowIso)
        .run();

    await env.DB.prepare(
        `
            DELETE FROM auth_attempts
            WHERE created_at < ?1
        `,
    )
        .bind(windowStartIso)
        .run();
};

const createSessionRecord = async (env, userId) => {
    const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const tokenHash = await sha256Base64(token);
    const createdAt = getNowIso();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    await env.DB.prepare(
        `
            INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?4)
        `,
    )
        .bind(crypto.randomUUID(), userId, tokenHash, createdAt, expiresAt)
        .run();

    return {
        token,
        expiresAt,
    };
};

const getUserState = async (env, userId) => {
    const row = await env.DB.prepare(
        `
            SELECT state_json, updated_at
            FROM user_states
            WHERE user_id = ?1
        `,
    )
        .bind(userId)
        .first();

    if (!row?.state_json) {
        return null;
    }

    try {
        return JSON.parse(row.state_json);
    } catch (error) {
        return null;
    }
};

const saveUserState = async (env, userId, state) => {
    const normalizedPayload = normalizeStatePayload(state);

    if (!normalizedPayload.ok) {
        throw new Error(normalizedPayload.error);
    }

    const nowIso = getNowIso();

    await env.DB.prepare(
        `
            INSERT INTO user_states (user_id, state_json, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?3)
            ON CONFLICT(user_id) DO UPDATE SET
                state_json = excluded.state_json,
                updated_at = excluded.updated_at
        `,
    )
        .bind(userId, normalizedPayload.serialized, nowIso)
        .run();

    return normalizedPayload.state;
};

const getAuthenticatedSession = async (request, env) => {
    const authorizationHeader = request.headers.get('Authorization') || '';
    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return null;
    }

    const tokenHash = await sha256Base64(token);
    const nowIso = getNowIso();
    const row = await env.DB.prepare(
        `
            SELECT
                sessions.id AS session_id,
                sessions.user_id AS user_id,
                sessions.expires_at AS expires_at,
                users.username AS username
            FROM sessions
            INNER JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ?1 AND sessions.expires_at > ?2
            LIMIT 1
        `,
    )
        .bind(tokenHash, nowIso)
        .first();

    if (!row) {
        return null;
    }

    await env.DB.prepare(
        `
            UPDATE sessions
            SET last_seen_at = ?2
            WHERE id = ?1
        `,
    )
        .bind(row.session_id, nowIso)
        .run();

    return {
        tokenHash,
        sessionId: row.session_id,
        expiresAt: row.expires_at,
        user: {
            id: row.user_id,
            username: row.username,
        },
    };
};

const deleteSession = async (env, sessionId) => {
    await env.DB.prepare(
        `
            DELETE FROM sessions
            WHERE id = ?1
        `,
    )
        .bind(sessionId)
        .run();
};

const handleSignup = async (request, env) => {
    const body = await parseJsonSafely(request);
    const usernameResult = validateUsername(body?.username);

    if (!usernameResult.ok) {
        return errorResponse(request, env, usernameResult.error, 400);
    }

    const passwordResult = validatePassword(body?.password);

    if (!passwordResult.ok) {
        return errorResponse(request, env, passwordResult.error, 400);
    }

    try {
        await assertRateLimit(env, request, 'signup', usernameResult.username);
    } catch (error) {
        return errorResponse(request, env, error.message, 429);
    }

    const existingUser = await env.DB.prepare(
        `
            SELECT id
            FROM users
            WHERE username = ?1
            LIMIT 1
        `,
    )
        .bind(usernameResult.username)
        .first();

    if (existingUser) {
        return errorResponse(request, env, 'That username is already taken.', 409);
    }

    const passwordHash = await hashPassword(passwordResult.password);
    const nowIso = getNowIso();
    const user = {
        id: crypto.randomUUID(),
        username: usernameResult.username,
    };

    await env.DB.prepare(
        `
            INSERT INTO users (
                id,
                username,
                password_hash,
                password_salt,
                password_iterations,
                created_at,
                updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
        `,
    )
        .bind(
            user.id,
            user.username,
            passwordHash.hash,
            passwordHash.salt,
            passwordHash.iterations,
            nowIso,
        )
        .run();

    const session = await createSessionRecord(env, user.id);

    return jsonResponse(request, env, {
        user,
        session,
        state: null,
    });
};

const handleLogin = async (request, env) => {
    const body = await parseJsonSafely(request);
    const usernameResult = validateUsername(body?.username);

    if (!usernameResult.ok) {
        return errorResponse(request, env, 'Invalid username or password.', 401);
    }

    const passwordResult = validatePassword(body?.password);

    if (!passwordResult.ok) {
        return errorResponse(request, env, 'Invalid username or password.', 401);
    }

    try {
        await assertRateLimit(env, request, 'login', usernameResult.username);
    } catch (error) {
        return errorResponse(request, env, error.message, 429);
    }

    const userRow = await env.DB.prepare(
        `
            SELECT
                id,
                username,
                password_hash,
                password_salt,
                password_iterations
            FROM users
            WHERE username = ?1
            LIMIT 1
        `,
    )
        .bind(usernameResult.username)
        .first();

    if (!userRow) {
        return errorResponse(request, env, 'Invalid username or password.', 401);
    }

    const passwordMatches = await verifyPassword(
        passwordResult.password,
        userRow.password_hash,
        userRow.password_salt,
        Number(userRow.password_iterations),
    );

    if (!passwordMatches) {
        return errorResponse(request, env, 'Invalid username or password.', 401);
    }

    const session = await createSessionRecord(env, userRow.id);
    const state = await getUserState(env, userRow.id);

    return jsonResponse(request, env, {
        user: {
            id: userRow.id,
            username: userRow.username,
        },
        session,
        state,
    });
};

const handleSession = async (request, env, authenticatedSession) => {
    const state = await getUserState(env, authenticatedSession.user.id);

    return jsonResponse(request, env, {
        user: authenticatedSession.user,
        expiresAt: authenticatedSession.expiresAt,
        state,
    });
};

const handleLogout = async (request, env, authenticatedSession) => {
    await deleteSession(env, authenticatedSession.sessionId);

    return jsonResponse(request, env, {
        success: true,
    });
};

const handleGetState = async (request, env, authenticatedSession) => {
    const state = await getUserState(env, authenticatedSession.user.id);

    return jsonResponse(request, env, {
        state,
    });
};

const handlePutState = async (request, env, authenticatedSession) => {
    const body = await parseJsonSafely(request);
    const normalizedPayload = normalizeStatePayload(body?.state);

    if (!normalizedPayload.ok) {
        return errorResponse(request, env, normalizedPayload.error, 400);
    }

    const state = await saveUserState(env, authenticatedSession.user.id, normalizedPayload.state);

    return jsonResponse(request, env, {
        state,
    });
};

const compareLeaderboardEntries = (left, right) => {
    if (left.score !== right.score) {
        return right.score - left.score;
    }

    if (left.correctCount !== right.correctCount) {
        return right.correctCount - left.correctCount;
    }

    if (left.wrongCount !== right.wrongCount) {
        return left.wrongCount - right.wrongCount;
    }

    if ((left.updatedAt || '') !== (right.updatedAt || '')) {
        return (right.updatedAt || '').localeCompare(left.updatedAt || '');
    }

    return left.username.localeCompare(right.username);
};

const handleLeaderboard = async (request, env) => {
    const rows = await env.DB.prepare(
        `
            SELECT
                users.id AS user_id,
                users.username AS username,
                user_states.state_json AS state_json,
                user_states.updated_at AS state_updated_at
            FROM users
            LEFT JOIN user_states ON user_states.user_id = users.id
        `,
    ).all();

    const leaderboard = (rows?.results || [])
        .map((row) => {
            let state = null;

            if (row?.state_json) {
                try {
                    state = JSON.parse(row.state_json);
                } catch (error) {
                    state = null;
                }
            }

            const summary = calculateLeaderboardScore(state);

            return {
                userId: row.user_id,
                username: row.username,
                score: summary.score,
                correctCount: summary.correctCount,
                wrongCount: summary.wrongCount,
                studiedCount: summary.studiedCount,
                updatedAt: row.state_updated_at || null,
            };
        })
        .sort(compareLeaderboardEntries)
        .map((entry, index) => ({
            ...entry,
            rank: index + 1,
        }));

    return jsonResponse(request, env, {
        leaderboard,
        totalUsers: leaderboard.length,
        generatedAt: getNowIso(),
    });
};

export const handleRequest = async (request, env) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: createCorsHeaders(request, env),
        });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
        return jsonResponse(request, env, { ok: true });
    }

    if (url.pathname === '/auth/signup' && request.method === 'POST') {
        return handleSignup(request, env);
    }

    if (url.pathname === '/auth/login' && request.method === 'POST') {
        return handleLogin(request, env);
    }

    if (url.pathname === '/leaderboard' && request.method === 'GET') {
        return handleLeaderboard(request, env);
    }

    const authenticatedSession = await getAuthenticatedSession(request, env);

    if (!authenticatedSession) {
        return errorResponse(request, env, 'Authentication required.', 401);
    }

    if (url.pathname === '/auth/session' && request.method === 'GET') {
        return handleSession(request, env, authenticatedSession);
    }

    if (url.pathname === '/auth/logout' && request.method === 'POST') {
        return handleLogout(request, env, authenticatedSession);
    }

    if (url.pathname === '/state' && request.method === 'GET') {
        return handleGetState(request, env, authenticatedSession);
    }

    if (url.pathname === '/state' && request.method === 'PUT') {
        return handlePutState(request, env, authenticatedSession);
    }

    return errorResponse(request, env, 'Not found.', 404);
};

export default {
    async fetch(request, env) {
        try {
            return await handleRequest(request, env);
        } catch (error) {
            console.error('Unhandled worker error', error);

            return errorResponse(
                request,
                env,
                'Internal server error.',
                500,
            );
        }
    },
};
