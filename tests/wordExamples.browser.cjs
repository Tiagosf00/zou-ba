// Run against a local production export with Playwright available in NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
            const context = await browser.newContext({ viewport });
            await context.addInitScript(() => {
                localStorage.setItem('zou-ba:app-state:v1:guest', JSON.stringify({
                    version: 1, updatedAt: new Date().toISOString(),
                    settings: { hskLevels: [1], vocabularyPool: 'custom', customCardIds: Array.from({ length: 12 }, (_, i) => i + 1),
                        inputMode: 'hanzi', outputMode: 'pinyin', themeMode: 'light' },
                }));
                const NativeAudio = window.Audio;
                window.testAudios = [];
                window.Audio = function (...args) {
                    const audio = new NativeAudio(...args);
                    window.testAudios.push(audio);
                    return audio;
                };
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await page.goto(process.env.TEST_BASE_URL || 'http://localhost:8765', { waitUntil: 'networkidle' });
            const play = page.getByRole('button', { name: 'Play example sentence', exact: true });
            assert.equal(await play.count(), 0, 'No example should reveal the answer early');
            await page.getByText("I don't know", { exact: true }).filter({ visible: true }).last().click();
            await play.waitFor();
            await play.click();
            await page.waitForFunction(() => window.testAudios.some((a) => !a.paused && a.currentTime > 0));
            assert.match(await page.evaluate(() => window.testAudios.at(-1).src), /audio\/hsk-sentences\/audio\/hsk1-/);
            await page.getByRole('button', { name: 'Another example', exact: true }).click();
            assert(await page.evaluate(() => window.testAudios.every((a) => a.paused)));
            await play.click();
            await page.waitForFunction(() => window.testAudios.at(-1).currentTime > 0);
            await page.getByRole('button', { name: /^Play .+ audio$/ }).first().click();
            assert(await page.evaluate(() => window.testAudios.slice(0, -1).every((a) => a.paused)));
            await play.click();
            await page.getByText(/^(Next card|Next)$/).click();
            assert(await page.evaluate(() => window.testAudios.every((a) => a.paused)));
            assert.equal(await play.count(), 0);
            await page.getByText("I don't know", { exact: true }).filter({ visible: true }).last().click();
            await play.click();
            await page.getByText('Exam', { exact: true }).last().click();
            assert(await page.evaluate(() => window.testAudios.every((a) => a.paused)), 'Tab change stops playback');
            await page.getByText('Start HSK 1 exam', { exact: true }).click();
            await page.getByText("I don't know", { exact: true }).filter({ visible: true }).last().click();
            await play.waitFor();
            await play.click();
            await page.waitForFunction(() => window.testAudios.at(-1).currentTime > 0);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
            assert.deepEqual(errors, []);
            console.log(`${viewport.width}px: Practice + Exam examples, actual MP3 playback, cycling, audio exclusion, card/tab cleanup, no overflow or page errors passed.`);
            await context.close();
        }
    } finally {
        await browser.close();
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
