import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { cleanupStorage, compactCloudState, expandCloudState, saveUserState } from '../src/index.js';

const DAY = 86400000;
const iso = (time) => new Date(time).toISOString();

// Execute the production queries against SQLite, including real transaction rollback.
function database(t) {
    const sqlite = new DatabaseSync(':memory:');
    t.after(() => sqlite.close());
    for (const name of ['0001_init.sql', '0002_user_state_versions.sql']) {
        sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
    }
    for (const id of ['alice', 'bob']) {
        sqlite.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(id, id, 'hash', 'salt', 100000, iso(0), iso(0));
    }
    const DB = {
        sqlite, batches: 0, beforeBatch: null,
        prepare(sql) {
            return {
                sql, args: {},
                bind(...values) {
                    this.args = Object.fromEntries(values.map((value, index) => [String(index + 1), value]));
                    return this;
                },
                async first() { return sqlite.prepare(sql).get(this.args) || null; },
                async run() { return { meta: sqlite.prepare(sql).run(this.args) }; },
            };
        },
        async batch(statements) {
            this.batches += 1;
            if (this.beforeBatch) {
                const before = this.beforeBatch;
                this.beforeBatch = null;
                await before();
            }
            sqlite.exec('BEGIN');
            try {
                const results = [];
                for (const statement of statements) results.push(await statement.run());
                sqlite.exec('COMMIT');
                return results;
            } catch (error) {
                sqlite.exec('ROLLBACK');
                throw error;
            }
        },
    };
    return { DB };
}

function state(count = 1, cardId = '1') {
    return {
        settings: { themeMode: 'dark', reviewCardIds: ['1', '301'] },
        progress: {
            cards: { [cardId]: {
                box: 1, lastResult: 'correct', correctCount: count, wrongCount: 0,
                unknownCount: 0, consecutiveCorrect: count,
                lastReviewedAt: '2026-11-23T01:00:00.000Z',
                nextReviewAt: '2026-11-24T01:00:00.000Z',
                introducedAt: '2026-11-20T01:00:00.000Z',
            } },
            dailyStudy: { dayKey: '2026-11-23', extraNewWords: 5, reviewAnswersSinceNew: 2,
                updatedAt: '2026-11-23T01:00:00.000Z' },
        },
    };
}

const currentRow = (env, user = 'alice') => env.DB.sqlite.prepare('SELECT * FROM user_states WHERE user_id = ?').get(user);
const current = (env, user = 'alice') => expandCloudState(JSON.parse(currentRow(env, user).state_json));
const versions = (env, user = 'alice') => env.DB.sqlite.prepare(
    'SELECT * FROM user_state_versions WHERE user_id = ? ORDER BY created_at DESC, id DESC',
).all(user);
const seedVersion = (env, id, user, time) => env.DB.sqlite.prepare(
    'INSERT INTO user_state_versions VALUES (?, ?, ?, ?, ?)',
).run(id, user, JSON.stringify(compactCloudState(state())), iso(time), iso(time));

test('many changed saves retain every answer but only one daily recovery snapshot', async (t) => {
    const env = database(t);
    await saveUserState(env, 'alice', state());
    assert.equal(versions(env).length, 0);
    for (let count = 2; count <= 30; count += 1) await saveUserState(env, 'alice', state(count));
    assert.equal(current(env).progress.cards['1'].correctCount, 30);
    assert.deepEqual(current(env).settings.reviewCardIds, ['1', '301']);
    assert.equal(versions(env).length, 1);
    assert.equal(expandCloudState(JSON.parse(versions(env)[0].state_json)).progress.cards['1'].correctCount, 1);
});

test('timestamp-only and reordered duplicate saves do not write or generate snapshots', async (t) => {
    const env = database(t);
    await saveUserState(env, 'alice', state());
    const before = currentRow(env);
    const duplicate = current(env);
    duplicate.updatedAt = '2099-01-01T00:00:00.000Z';
    duplicate.progress.updatedAt = duplicate.updatedAt;
    duplicate.progress.dailyStudy.updatedAt = duplicate.updatedAt;
    duplicate.settings = { reviewCardIds: ['1', '301'], themeMode: 'dark' };
    const response = await saveUserState(env, 'alice', duplicate);
    assert.equal(env.DB.batches, 1);
    assert.deepEqual(currentRow(env), before);
    assert.equal(versions(env).length, 0);
    assert.equal(response.progress.cards['1'].correctCount, 1);
    // An actual setting change must still be persisted.
    duplicate.settings.themeMode = 'light';
    await saveUserState(env, 'alice', duplicate);
    assert.equal(current(env).settings.themeMode, 'light');
    assert.equal(versions(env).length, 1);
});

test('history is bounded to three recent versions per user and snapshots resume after 24 hours', async (t) => {
    const env = database(t);
    const now = Date.now();
    await saveUserState(env, 'alice', state());
    await saveUserState(env, 'bob', state());
    for (let day = 2; day <= 10; day += 1) seedVersion(env, `a-${day}`, 'alice', now - day * DAY);
    seedVersion(env, 'bob-keep', 'bob', now - DAY);
    await saveUserState(env, 'alice', state(2));
    const kept = versions(env);
    assert.equal(kept.length, 3);
    assert.ok(Date.parse(kept[0].created_at) >= now);
    assert.deepEqual(kept.slice(1).map((v) => v.id), ['a-2', 'a-3']);
    assert.deepEqual(versions(env, 'bob').map((v) => v.id), ['bob-keep']);
    await saveUserState(env, 'alice', state(3));
    assert.deepEqual(versions(env), kept);
});

test('failed current-state writes roll back snapshot creation and retention deletes', async (t) => {
    const env = database(t);
    await saveUserState(env, 'alice', state());
    seedVersion(env, 'old-version', 'alice', Date.now() - 10 * DAY);
    const before = currentRow(env);
    env.DB.sqlite.exec(`CREATE TRIGGER fail_save BEFORE UPDATE ON user_states
        BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END`);
    await assert.rejects(saveUserState(env, 'alice', state(2)), /simulated storage failure/);
    assert.deepEqual(currentRow(env), before);
    assert.deepEqual(versions(env).map((v) => v.id), ['old-version']);
});

test('concurrent device saves re-read and merge instead of replacing another device progress', async (t) => {
    const env = database(t);
    await saveUserState(env, 'alice', state());
    env.DB.beforeBatch = () => saveUserState(env, 'alice', state(4, '301'));
    await saveUserState(env, 'alice', state(2));
    assert.equal(current(env).progress.cards['1'].correctCount, 2);
    assert.equal(current(env).progress.cards['301'].correctCount, 4);
    assert.equal(versions(env).length, 1);
    assert.equal(env.DB.batches, 4); // initial, competing device, failed CAS, retry
});

test('daily maintenance removes expired history/auth records and keeps current states and live sessions', async (t) => {
    const env = database(t);
    const now = Date.now();
    await saveUserState(env, 'alice', state(5));
    await saveUserState(env, 'bob', state(8));
    const aliceBefore = currentRow(env);
    const bobBefore = currentRow(env, 'bob');
    for (let day = 1; day <= 9; day += 1) seedVersion(env, `a-${day}`, 'alice', now - day * DAY);
    seedVersion(env, 'b-old', 'bob', now - 8 * DAY);
    for (const [id, expires] of [['expired', now - DAY], ['active', now + DAY]]) {
        env.DB.sqlite.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)')
            .run(id, 'alice', id, iso(now - 2 * DAY), iso(expires), iso(now));
    }
    for (const [id, time] of [['old', now - DAY], ['recent', now]]) {
        env.DB.sqlite.prepare('INSERT INTO auth_attempts VALUES (?, ?, ?, ?)')
            .run(id, 'login', id, iso(time));
    }
    await cleanupStorage(env, now);
    assert.deepEqual(versions(env).map((v) => v.id), ['a-1', 'a-2', 'a-3']);
    assert.equal(versions(env, 'bob').length, 0);
    assert.deepEqual(currentRow(env), aliceBefore);
    assert.deepEqual(currentRow(env, 'bob'), bobBefore);
    assert.deepEqual(env.DB.sqlite.prepare('SELECT id FROM sessions').all().map((r) => r.id), ['active']);
    assert.deepEqual(env.DB.sqlite.prepare('SELECT id FROM auth_attempts').all().map((r) => r.id), ['recent']);
});

test('oversize updates cannot delete recovery history or overwrite current progress', async (t) => {
    const env = database(t);
    await saveUserState(env, 'alice', state());
    seedVersion(env, 'recovery', 'alice', Date.now());
    const before = currentRow(env);
    const oversized = state(2);
    oversized.settings.large = 'x'.repeat(1024 * 1024);
    await assert.rejects(saveUserState(env, 'alice', oversized), /too large/);
    assert.deepEqual(currentRow(env), before);
    assert.equal(versions(env).length, 1);
});

test('one-time cleanup migration is idempotent and never changes current state', async (t) => {
    const env = database(t);
    const now = Date.now();
    await saveUserState(env, 'alice', state(5));
    const before = currentRow(env);
    for (let day = 1; day <= 9; day += 1) seedVersion(env, `a-${day}`, 'alice', now - day * DAY);
    const migration = readFileSync(new URL('../migrations/0003_bound_state_history.sql', import.meta.url), 'utf8');
    env.DB.sqlite.exec(migration);
    env.DB.sqlite.exec(migration);
    assert.deepEqual(versions(env).map((v) => v.id), ['a-1', 'a-2', 'a-3']);
    assert.deepEqual(currentRow(env), before);
});
