const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');

// Load the app's ES modules without changing Expo's package configuration.
const cache = new Map();
function loadAppModule(relativePath) {
    const filename = path.resolve(__dirname, relativePath);
    if (cache.has(filename)) return cache.get(filename).exports;
    const instance = new Module(filename, module);
    cache.set(filename, instance);
    instance.filename = filename;
    instance.paths = Module._nodeModulePaths(path.dirname(filename));
    instance.require = (specifier) => {
        if (specifier.startsWith('.') && !specifier.endsWith('.json')) {
            return loadAppModule(path.resolve(path.dirname(filename), `${specifier}.js`));
        }
        return Module.prototype.require.call(instance, specifier);
    };
    instance._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        filename, configFile: false, babelrc: false,
        plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code, filename);
    return instance.exports;
}

const {
    createPracticeProgress, normalizePracticeProgress, getDailyStudySnapshot, getStudyDay,
    pickNextQuestion, recordStudyAnswer, recordRoundResult, addExtraNewWords,
} = loadAppModule('../src/utils/practice.js');
const { createAppState, normalizeAppState, withUpdatedProgress, withUpdatedSettings, resolveCloudSaveResponse } = loadAppModule('../src/utils/appState.js');
const { encodeCloudState, decodeCloudState } = loadAppModule('../src/utils/cloudStateCodec.js');
const { normalizeSettings } = loadAppModule('../src/constants/defaultSettings.js');
const now = new Date('2026-10-12T01:00:00.000Z');
const settings = { newWordsPerDay: 10, studyTimeZone: 'Asia/Shanghai' };
const items = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 }));
const oldEntry = {
    box: 3, lastResult: 'correct', correctCount: 3, wrongCount: 0, unknownCount: 0,
    consecutiveCorrect: 3, lastReviewedAt: '2026-10-01T01:00:00.000Z',
    nextReviewAt: '2026-10-04T01:00:00.000Z',
};
const backlog = () => createPracticeProgress('default',
    Object.fromEntries(items.slice(0, 300).map(({ id }) => [id, { ...oldEntry }])), now.toISOString());
const snapshot = (progress, at = now, prefs = settings) => getDailyStudySnapshot(progress.cards, prefs, progress.dailyStudy, at);
const next = (progress, pool = items, at = now, prefs = settings) => pickNextQuestion(pool, progress.cards, at, [], snapshot(progress, at, prefs));

test('300 overdue / 700 unseen: ten new words within fifty answers, despite reviews remaining', () => {
    let progress = backlog();
    const newSlots = [];
    for (let i = 0; i < 50; i++) {
        const at = new Date(now.getTime() + i * 30000);
        const item = next(progress, items, at);
        if (!progress.cards[item.id]) newSlots.push(i + 1);
        progress = recordStudyAnswer(progress, item, true, settings, at);
    }
    assert.deepEqual(newSlots, [1, 6, 11, 16, 21, 26, 31, 36, 41, 46]);
    assert.equal(snapshot(progress).introducedToday, 10);
    assert.ok(progress.cards[next(progress).id], 'After the target, pick a review');
});

test('wrong answers and reveals cannot starve new words', () => {
    let progress = backlog();
    for (let i = 0; i < 50; i++) {
        const at = new Date(now.getTime() + i * 30000);
        const item = next(progress, items, at);
        assert.equal(!progress.cards[item.id], i % 5 === 0);
        progress = recordStudyAnswer(progress, item, false, settings, at, { countAsWrong: i % 2 === 0 });
    }
    assert.equal(snapshot(progress).introducedToday, 10);
});

test('failed due cards keep priority within review slots, future cards are not selected', () => {
    let progress = recordStudyAnswer(backlog(), items[300], true, settings, now);
    progress.cards[2] = { ...oldEntry, lastResult: 'wrong' };
    progress.cards[3] = { ...oldEntry, lastResult: 'wrong', nextReviewAt: '2026-10-13T00:00:00.000Z' };
    assert.equal(next(progress).id, 2);
});

test('no due reviews: introduce consecutive new words, then stop at the target', () => {
    let progress = createPracticeProgress();
    for (let i = 0; i < 10; i++) {
        const item = next(progress);
        assert.ok(!progress.cards[item.id]);
        progress = recordStudyAnswer(progress, item, true, settings, now);
    }
    assert.equal(next(progress), null);
    const more = addExtraNewWords(progress, settings, now);
    assert.equal(snapshot(more).allowance, 15);
    assert.ok(next(more));
    assert.equal(settings.newWordsPerDay, 10);
});

test('zero target, empty pools and all-studied pools behave correctly', () => {
    const zero = { ...settings, newWordsPerDay: 0 };
    assert.equal(next(createPracticeProgress(), items, now, zero), null);
    assert.ok(next(backlog(), items, now, zero));
    assert.equal(next(backlog(), []), null);
    assert.ok(next(backlog(), items.slice(0, 300)));
    const extra = addExtraNewWords(createPracticeProgress(), zero, now);
    assert.ok(next(extra, items, now, zero));
});

test('displaying a question does not count; repeated answers preserve its first introduction', () => {
    let progress = createPracticeProgress();
    const item = next(progress);
    assert.equal(snapshot(progress).introducedToday, 0);
    progress = recordStudyAnswer(progress, item, false, settings, now, { countAsWrong: false });
    progress = recordStudyAnswer(progress, item, true, settings, new Date(now.getTime() + 120000));
    assert.equal(snapshot(progress).introducedToday, 1);
    assert.equal(progress.cards[item.id].introducedAt, now.toISOString());
    assert.equal(progress.cards[item.id].unknownCount, 1);
});

test('refresh and pool changes preserve the cadence and shared allowance', () => {
    let progress = recordStudyAnswer(backlog(), items[300], true, settings, now);
    for (const item of items.slice(0, 3)) progress = recordStudyAnswer(progress, item, true, settings, now);
    let state = createAppState({ progress, settings });
    state = normalizeAppState(JSON.parse(JSON.stringify(state)));
    state = withUpdatedSettings(state, { hskLevels: [4], vocabularyPool: 'custom', customCardIds: [1, 2, 3, 4, 5, 6] });
    state = withUpdatedProgress(state, state.progress);
    assert.equal(snapshot(state.progress).daily.reviewAnswersSinceNew, 3);
    assert.ok(state.progress.cards[next(state.progress).id]);
    state.progress = recordStudyAnswer(state.progress, items[3], true, settings, now);
    const selected = next(state.progress, items.slice(4));
    assert.ok(!state.progress.cards[selected.id]);
    assert.equal(snapshot(state.progress).introducedToday, 1);
});

test('saved timezone midnight resets counts, cadence and extras without accumulating missed days', () => {
    const before = new Date('2026-10-12T15:59:59.000Z');
    const after = new Date('2026-10-12T16:00:00.000Z');
    let progress = recordStudyAnswer(backlog(), items[300], true, settings, before);
    progress = addExtraNewWords(progress, settings, before);
    assert.equal(snapshot(progress, before).introducedToday, 1);
    assert.equal(snapshot(progress, before).allowance, 15);
    assert.equal(getStudyDay(after, settings.studyTimeZone), '2026-10-13');
    for (const at of [after, new Date('2026-10-20T01:00:00Z')]) {
        assert.equal(snapshot(progress, at).introducedToday, 0);
        assert.equal(snapshot(progress, at).allowance, 10);
        assert.equal(snapshot(progress, at).daily.reviewAnswersSinceNew, 0);
        assert.ok(!progress.cards[next(progress, items, at).id]);
    }
    assert.equal(getStudyDay('2026-11-01T06:00:00Z', 'America/New_York'), '2026-11-01');
});

test('exam introductions count once and exams continue beyond the practice allowance', () => {
    const prefs = { ...settings, newWordsPerDay: 1 };
    let progress = createPracticeProgress();
    for (const item of items.slice(0, 2)) {
        progress = recordStudyAnswer(progress, item, true, prefs, now, { source: 'exam' });
    }
    assert.equal(snapshot(progress, now, prefs).introducedToday, 2);
    assert.equal(snapshot(progress, now, prefs).canIntroduce, false);
    progress = recordStudyAnswer(progress, items[0], true, prefs, now, { source: 'exam' });
    assert.equal(progress.dailyStudy.reviewAnswersSinceNew, 0);
    assert.equal(snapshot(progress, now, prefs).introducedToday, 2);
    const extra = addExtraNewWords(progress, prefs, now);
    assert.equal(snapshot(extra, now, prefs).allowance, 7, 'Learn five more allows five beyond the current count');
});

test('old progress keeps dates and history; reviewing it does not invent an introduction date', () => {
    const progress = normalizePracticeProgress({ cards: { 1: oldEntry } });
    assert.deepEqual(progress.cards[1], oldEntry);
    assert.equal(progress.dailyStudy, null);
    const reviewed = recordStudyAnswer(progress, items[0], true, settings, now);
    assert.equal(reviewed.cards[1].introducedAt, undefined);
    assert.equal(snapshot(reviewed).introducedToday, 0);
});

test('existing review intervals and failure scheduling stay intact', () => {
    let cards = {};
    let at = now;
    for (const minutes of [10, 1440, 4320, 10080, 20160, 43200, 43200]) {
        cards = recordRoundResult(cards, items[0], true, at);
        assert.equal((Date.parse(cards[1].nextReviewAt) - at.getTime()) / 60000, minutes);
        at = new Date(cards[1].nextReviewAt);
    }
    cards = recordRoundResult(cards, items[0], false, at);
    assert.equal(cards[1].box, 0);
    assert.equal((Date.parse(cards[1].nextReviewAt) - at.getTime()) / 60000, 2);
});

test('frontend and backend cloud formats retain introductions, daily state and settings', async () => {
    const { compactCloudState, expandCloudState } = await import('../backend/src/index.js');
    const progress = addExtraNewWords(recordStudyAnswer(backlog(), items[300], true, settings, now), settings, now);
    const state = createAppState({ progress, settings });
    const frontWire = encodeCloudState(state);
    assert.deepEqual(normalizeAppState(decodeCloudState(frontWire)), state);
    assert.deepEqual(normalizeAppState(expandCloudState(frontWire)), state);
    assert.deepEqual(normalizeAppState(decodeCloudState(compactCloudState(state))), state);
    assert.equal(frontWire.p.c[1][8], null, 'Legacy cards retain unknown introduction dates');
    const oldWire = { ...frontWire, p: { ...frontWire.p, d: undefined, c: { 1: frontWire.p.c[1].slice(0, 8) } } };
    assert.deepEqual(normalizeAppState(decodeCloudState(oldWire)).progress.cards[1], oldEntry);
});

test('settings migrate to ten new words and reject invalid target/timezone values', () => {
    assert.equal(normalizeSettings({}).newWordsPerDay, 10);
    assert.equal(normalizeSettings({ newWordsPerDay: 0 }).newWordsPerDay, 0);
    assert.equal(normalizeSettings({ newWordsPerDay: -5 }).newWordsPerDay, 0);
    assert.equal(normalizeSettings({ newWordsPerDay: 5000 }).newWordsPerDay, 1000);
    assert.equal(normalizeSettings({ newWordsPerDay: 'bad' }).newWordsPerDay, 10);
    assert.notEqual(normalizeSettings({ studyTimeZone: 'invalid/timezone' }).studyTimeZone, 'invalid/timezone');
});

test('an in-flight cloud save cannot roll back a newer daily allowance or target', () => {
    const sent = createAppState({ progress: backlog(), settings, updatedAt: now.toISOString() });
    const current = createAppState({
        progress: addExtraNewWords(sent.progress, settings, new Date(now.getTime() + 1000)),
        settings: { ...settings, newWordsPerDay: 15 },
        updatedAt: new Date(now.getTime() + 1000).toISOString(),
    });
    const saved = { ...sent, updatedAt: new Date(now.getTime() + 2000).toISOString() };
    assert.equal(resolveCloudSaveResponse(current, sent, saved), current);
    assert.equal(resolveCloudSaveResponse(sent, sent, saved), saved);
    const nextSaved = { ...current, updatedAt: new Date(now.getTime() + 3000).toISOString() };
    assert.equal(resolveCloudSaveResponse(current, current, nextSaved), nextSaved);
});
