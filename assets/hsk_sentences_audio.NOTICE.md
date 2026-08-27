# HSK Sentences Audio attribution

The listening-practice metadata in `hsk_sentences_audio.json` is derived from
[no7z/hsk-sentences-audio](https://huggingface.co/datasets/no7z/hsk-sentences-audio),
licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

The streamed recordings are synthetic speech generated with CosyVoice2-0.5B.
The source dataset includes additional CC-CEDICT-derived fields; the app's compact
deck retains sentence text, pinyin, translations, classifications, and audio paths.

Run `npm run generate:sentence-deck` to refresh the compact deck from the upstream
JSON Lines export. Run `npm run download:sentence-audio` to download or resume the
normal and slow MP3 collection for local-first playback.
