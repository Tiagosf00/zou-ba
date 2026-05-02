# How to Test Your App Locally

This project is web-only.

## Install

From the project root:

```bash
npm install
npm --prefix backend install
```

## Local Preview

For guest-mode testing:

```bash
npm run web -- --port 8091
```

Open `http://localhost:8091`.

For cloud auth/sync testing, start the backend in a second terminal:

```bash
npm --prefix backend run dev
```

Then start the frontend with the local backend URL:

```bash
EXPO_PUBLIC_API_BASE_URL="http://127.0.0.1:8787" npm run web -- --port 8091
```

## Quick Checks

1. Practice: choose an HSK level in Settings, answer a card correctly, and confirm the streak increases.
2. Practice: tap `I don't know`; the answer should reveal, the message should say it counts as a failed review, and the card should return after about 2 minutes.
3. Practice and Exam: while logged in as `tiagodfs`, after answering, the small audio button should appear next to the revealed word and play audio.
4. Practice, Exam, and Stats: while logged out or logged in as any other user, audio buttons should not appear.
5. Stats: while logged in as `tiagodfs`, expand a level and confirm word rows show the audio button.
6. Pinyin: spot-check `可能` as `kě néng`, `鸟` as `niǎo`, and `谁` as `shéi/shuí`.
7. Cloud sync: create an account from Settings, log out, log back in, and confirm progress/settings restore.
8. Other devices: when testing the local frontend from another machine or phone, use the computer's LAN URL for the frontend. Auth should no longer fail from arbitrary localhost/LAN ports.

## Automated Checks

Run the pinyin regression tests:

```bash
python3 -m unittest discover -s tests
```

Run backend tests:

```bash
npm --prefix backend test
```

Generate a production web build:

```bash
npm run export:web
```

The exported files are written to `dist/`.

## Data Generation

Regenerate the PDF HSK deck:

```bash
npm run generate:pdf-deck
```

Regenerate the valid pinyin list:

```bash
npm run generate:pinyin
```

Regenerate the bundled audio asset map and source list:

```bash
npm run generate:audio-assets
npm run generate:audio-sources
```
