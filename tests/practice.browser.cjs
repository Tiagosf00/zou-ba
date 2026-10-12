// Run after export:web, with Playwright in NODE_PATH and a local dist/ server.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const words = require('../assets/hsk_1_6_pdf_dataset_english.json').filter((word) => word.level === 4);
const storageKey = 'zou-ba:app-state:v1:guest';
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8766';

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        fs.mkdirSync(path.resolve(__dirname, '../tmp'), { recursive: true });
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
            const context = await browser.newContext({ viewport });
            const seed = {
                version: 1, updatedAt: new Date().toISOString(),
                settings: { hskLevels: [4], inputMode: 'hanzi', outputMode: 'pinyin',
                    newWordsPerDay: 10, studyTimeZone: 'Asia/Shanghai' },
                progress: { cards: Object.fromEntries(words.slice(0, 20).map(({ id }) => [id, {
                    box: 3, lastResult: 'correct', correctCount: 3, wrongCount: 0,
                    unknownCount: 0, consecutiveCorrect: 3,
                    lastReviewedAt: '2026-01-01T00:00:00.000Z', nextReviewAt: '2026-01-08T00:00:00.000Z',
                }])) },
            };
            await context.addInitScript(({ storageKey, seed }) => {
                if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(seed));
            }, { storageKey, seed });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await page.goto(baseURL, { waitUntil: 'networkidle' });
            const badge = (label) => page.getByText(label, { exact: true }).filter({ visible: true });
            const reveal = async () => page.getByText("I don't know", { exact: true }).filter({ visible: true }).last().click();
            const advance = async () => page.getByText(/^(Next card|Next)$/).filter({ visible: true }).last().click();
            await badge('New').waitFor();
            await page.getByText('New today: 0 / 10', { exact: true }).waitFor();
            await reveal();
            await page.getByText('New today: 1 / 10', { exact: true }).waitFor();
            await advance();
            for (let i = 0; i < 2; i++) {
                await badge('Review').waitFor();
                await reveal();
                await advance();
            }
            await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).progress.dailyStudy.reviewAnswersSinceNew === 2, storageKey);
            await page.reload({ waitUntil: 'networkidle' });
            for (let i = 0; i < 2; i++) {
                await badge('Review').waitFor();
                await reveal();
                await advance();
            }
            await badge('New').waitFor();
            await reveal();
            await page.getByText('New today: 2 / 10', { exact: true }).waitFor();
            await advance();
            await page.getByText('Settings', { exact: true }).last().click();
            await page.getByLabel('New words per day', { exact: true }).fill('2');
            await page.getByLabel('New words per day', { exact: true }).blur();
            await page.getByText('Practice', { exact: true }).last().click();
            await page.getByText('New today: 2 / 2', { exact: true }).waitFor();
            await badge('Review').waitFor();
            await page.getByText('Learn 5 more today', { exact: true }).click();
            await page.getByText('New today: 2 / 7', { exact: true }).waitFor();
            await reveal();
            await advance();
            await badge('New').waitFor();
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            await page.screenshot({ path: path.resolve(__dirname, `../tmp/practice-${viewport.width}.png`), fullPage: true });
            assert.deepEqual(errors, []);
            await context.close();
        }

        const context = await browser.newContext();
        await context.addInitScript((key) => localStorage.setItem(key, JSON.stringify({
            settings: { hskLevels: [4], newWordsPerDay: 0 },
        })), storageKey);
        const page = await context.newPage();
        await page.goto(baseURL, { waitUntil: 'networkidle' });
        await page.getByText("Today's new-word allowance is complete.", { exact: true }).waitFor();
        await page.getByText('Learn 5 more today', { exact: true }).click();
        await page.getByText('New', { exact: true }).filter({ visible: true }).waitFor();
        await page.getByText("I don't know", { exact: true }).filter({ visible: true }).last().click();
        await page.getByText('New today: 1 / 5', { exact: true }).waitFor();
        await context.close();
        console.log('Practice browser checks passed: desktop/mobile cadence, refresh, settings, extra allowance, zero target.');
    } finally {
        await browser.close();
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
