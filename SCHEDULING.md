# Practice scheduling

Practice defaults to 10 new words per study day. Change this in Settings → Learning pace;
0 means reviews only. The allowance is shared across HSK levels and custom vocabulary.

When unseen words and due reviews are available, the first introduction of the day
comes first, then another new word follows every four completed review answers.
Wrong answers and “I don't know” count toward those four answers. Failed due words
have priority within review slots. When no reviews are due, new words can follow
consecutively until the allowance is used. A new-word slot falls back to a review
when the selected pool has no unseen words.

An introduction counts on the first submitted answer or reveal, not when a question
is displayed. Exam introductions count too, but exams are never stopped by the
practice allowance. “Learn 5 more today” makes room for five additional introductions,
including when an exam or a reduced target has already put the count over the allowance.
The daily extra allowance is capped at 1,000, as is the regular target.

Daily counts and extras reset at midnight in the saved study timezone, initialized
from the browser's timezone and displayed in Settings. Missed days do not accumulate
new-word allowances. Refreshes and vocabulary changes preserve the day's cadence.
Existing studied words remain studied; their unknown historical introduction dates
are not guessed or counted as new introductions.

This is a queue-policy change, not an SM-2 or FSRS implementation. The existing review
intervals remain 10 minutes, 1 day, 3 days, 7 days, 14 days, then 30 days. A failed
answer resets the word to the first stage and schedules it two minutes later.

## Storage and rollout

- Card progress optionally includes `introducedAt`, retained across subsequent answers.
- Progress includes `dailyStudy`: `dayKey`, `reviewAnswersSinceNew`, `extraNewWords`,
  and `updatedAt`. Cadence advances only for practice reviews; an exam introduction
  resets it, while an exam review does not advance it.
- Settings include `newWordsPerDay` and `studyTimeZone`.
- Compact cloud v2 is extended with optional card-array position 8 (`introducedAt`)
  and `p.d` (`dailyStudy`). Existing eight-position cards remain readable.
- Backend merges preserve the earliest known introduction, newer daily state, and
  the larger extra allowance for the same day. Old clients omitting these fields
  cannot erase already-saved metadata, but cannot record new introductions themselves.

Deploy the updated backend before the frontend: an old backend drops the new
metadata. Existing card dates and answer counts require no rescheduling or reset.
Sequential use across updated devices retains the allowance after syncing.
Simultaneous offline sessions can exceed it before reconciling; it is not a server
enforced quota.

## Verification

```sh
node --test tests/practice.test.cjs
npm --prefix backend test
npm run export:web
```

The scheduler regression includes a 1,000-word deck with 300 overdue words: new
introductions occur at answers 1, 6, 11, …, 46, even if every answer is wrong.

With Playwright available through `NODE_PATH`, serve `dist/` locally and run:

```sh
TEST_BASE_URL=http://127.0.0.1:8766 node tests/practice.browser.cjs
```

The browser check covers desktop/mobile practice, refresh, the daily target setting,
extra words, and a zero-target empty state. Screenshots are written to `tmp/`.
