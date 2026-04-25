import test from 'node:test';
import assert from 'node:assert/strict';

import {
    calculateLeaderboardScore,
    hashPassword,
    getCardLevelWeight,
    mergeAppStateForSave,
    normalizeStatePayload,
    summarizeProgressState,
    validatePassword,
    validateUsername,
    verifyPassword,
} from '../src/index.js';

test('validateUsername normalizes and accepts lowercase handles', () => {
    const result = validateUsername('  Tiago_01 ');

    assert.equal(result.ok, true);
    assert.equal(result.username, 'tiago_01');
});

test('validateUsername rejects unsupported characters', () => {
    const result = validateUsername('bad name');

    assert.equal(result.ok, false);
});

test('validatePassword enforces a minimum length', () => {
    const result = validatePassword('12345');

    assert.equal(result.ok, false);
});

test('hashPassword and verifyPassword round-trip correctly', async () => {
    const password = 'secret-password';
    const hashed = await hashPassword(password);

    assert.equal(await verifyPassword(password, hashed.hash, hashed.salt, hashed.iterations), true);
    assert.equal(await verifyPassword('wrong-password', hashed.hash, hashed.salt, hashed.iterations), false);
});

test('normalizeStatePayload rejects arrays and oversize values', () => {
    assert.equal(normalizeStatePayload([]).ok, false);
    assert.equal(normalizeStatePayload({ version: 1, settings: {}, progress: {} }).ok, true);
});

test('getCardLevelWeight resolves HSK weights from card ids', () => {
    assert.equal(getCardLevelWeight(1), 1);
    assert.equal(getCardLevelWeight(301), 2);
});

test('calculateLeaderboardScore applies per-level weights to correct and wrong totals', () => {
    const summary = calculateLeaderboardScore({
        progress: {
            cards: {
                1: {
                    correctCount: 3,
                    wrongCount: 1,
                },
                301: {
                    correctCount: 2,
                    wrongCount: 1,
                },
                501: {
                    correctCount: 0,
                    wrongCount: 1,
                },
            },
        },
    });

    assert.deepEqual(summary, {
        score: 1,
        correctCount: 5,
        wrongCount: 3,
        studiedCount: 3,
        masteredCount: 0,
    });
});

test('summarizeProgressState counts total progress attempts', () => {
    const summary = summarizeProgressState({
        progress: {
            cards: {
                1: {
                    correctCount: 3,
                    wrongCount: 1,
                },
                2: {
                    correctCount: 1,
                    wrongCount: 0,
                },
            },
        },
    });

    assert.deepEqual(summary, {
        correctCount: 4,
        wrongCount: 1,
        attemptCount: 5,
        studiedCount: 2,
    });
});

test('mergeAppStateForSave keeps newer progress when a stale state is saved', () => {
    const mergedState = mergeAppStateForSave(
        {
            version: 1,
            settings: {
                themeMode: 'light',
            },
            progress: {
                cards: {
                    1: {
                        box: 4,
                        lastResult: 'correct',
                        correctCount: 8,
                        wrongCount: 1,
                        consecutiveCorrect: 4,
                        lastReviewedAt: '2026-04-23T10:00:00.000Z',
                        nextReviewAt: '2026-04-24T10:00:00.000Z',
                    },
                    2: {
                        box: 1,
                        lastResult: 'wrong',
                        correctCount: 0,
                        wrongCount: 1,
                        consecutiveCorrect: 0,
                        lastReviewedAt: '2026-04-23T11:00:00.000Z',
                        nextReviewAt: '2026-04-23T11:02:00.000Z',
                    },
                },
                updatedAt: '2026-04-23T11:00:00.000Z',
            },
            updatedAt: '2026-04-23T11:00:00.000Z',
        },
        {
            version: 1,
            settings: {
                themeMode: 'dark',
            },
            progress: {
                cards: {
                    1: {
                        box: 2,
                        lastResult: 'correct',
                        correctCount: 3,
                        wrongCount: 0,
                        consecutiveCorrect: 2,
                        lastReviewedAt: '2026-04-24T10:00:00.000Z',
                        nextReviewAt: '2026-04-25T10:00:00.000Z',
                    },
                },
                updatedAt: '2026-04-24T10:00:00.000Z',
            },
            updatedAt: '2026-04-24T10:00:00.000Z',
        },
        '2026-04-24T12:00:00.000Z',
    );

    assert.equal(mergedState.settings.themeMode, 'dark');
    assert.equal(mergedState.progress.cards[1].correctCount, 8);
    assert.equal(mergedState.progress.cards[2].wrongCount, 1);
    assert.equal(mergedState.updatedAt, '2026-04-24T12:00:00.000Z');
});
