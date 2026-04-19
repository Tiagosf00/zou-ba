import test from 'node:test';
import assert from 'node:assert/strict';

import {
    hashPassword,
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
