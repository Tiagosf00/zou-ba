# New HSK 3.0 sentence deck attribution

The listening-practice sentences, translations, pinyin and AI-generated Mandarin audio
come from the free
[New HSK 3.0 Mandarin Chinese Sentence Deck](https://ankiweb.net/shared/info/258311532)
created by NewHSK3. The separately distributed HSK 5 and HSK 6 packages come from the
author's [version 1.0 release](https://github.com/NewHSK3/new-hsk-3-anki-deck/releases/tag/v1.0).

The author permits personal, classroom and educational use. This project uses the deck
for free, noncommercial listening practice, does not place it behind a paywall and does
not present the source material as its own work. Source fonts, software and stroke-order
assets are not included.

The author describes the recordings as AI-generated standard Mainland Mandarin with
alternating voices and notes that occasional synthesis errors may remain. The app keeps
the original MP3 recordings unchanged and generates its slow mode at playback time.

To rebuild the corpus, download the HSK 1-4 package from AnkiWeb and run:

```sh
npm run download:sentence-audio -- --hsk1-4 /path/to/New_HSK_30_Mandarin_Chinese_Sentence_Deck.apkg
```

Vocabulary answer details reuse these sentences and MP3s through
`assets/hsk_word_examples.json`. Rebuild that lookup without changing vocabulary or
extracting audio again:

```sh
python3 scripts/build_word_examples.py /path/to/HSK1-4.apkg /path/to/HSK5.apkg /path/to/HSK6.apkg
```

The lookup matches HSK level, focus word and tone-preserving pinyin, with reviewed
sense filters for same-reading homographs. Its `unmatched` list records entries
requiring review. Existing manually written examples remain a text-only fallback.
The packages contain sentence recordings only; existing standalone word audio is
unchanged.
