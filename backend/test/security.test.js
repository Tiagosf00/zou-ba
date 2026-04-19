import test from 'node:test';
import assert from 'node:assert/strict';

import {
    calculateLeaderboardScore,
    hashPassword,
    getCardLevelWeight,
    normalizeStatePayload,
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
    });
});
