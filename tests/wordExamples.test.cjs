const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');

const filename = path.resolve(__dirname, '../src/utils/wordExamples.js');
const compiled = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const instance = new Module(filename, module);
instance.filename = filename;
instance.paths = Module._nodeModulePaths(path.dirname(filename));
instance._compile(compiled, filename);
const { getWordExamples } = instance.exports;
const words = require('../assets/hsk_1_6_pdf_dataset_english.json');
const word = (id) => words.find((item) => item.id === id);

assert.equal(getWordExamples(word(1)).length, 3);
assert.equal(getWordExamples(word(153))[0].pinyin.includes('&#'), false);
assert.equal(getWordExamples(word(357)).length, 3); // spend
assert.equal(getWordExamples(word(358)).length, 0); // flower: different meaning
assert.equal(getWordExamples(word(1646)).length, 3); // give birth
assert.equal(getWordExamples(word(1647)).length, 3); // raw
assert.equal(getWordExamples({ ...word(1), pinyin: 'āi', exampleSentence: '' }).length, 0);
const fallback = getWordExamples({ id: 'custom', hanzi: '爱', exampleSentence: '我爱你。',
    examplePinyin: 'Wǒ ài nǐ.', exampleEnglishTranslation: 'I love you.' });
assert.equal(fallback.length, 1);
assert.equal(fallback[0].audioNormal, undefined);
assert.deepEqual(getWordExamples({ id: 1, hanzi: 'different', level: 1, pinyin: 'ài' }), []);
console.log('Word example lookup: sense separation, readings, escaped text and fallbacks passed.');
