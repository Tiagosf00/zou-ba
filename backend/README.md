# Zou Ba Backend

Cloudflare Worker + D1 backend for:

- username/password signup
- login/logout with bearer sessions
- one persisted app-state blob per user

## Setup

1. Create a D1 database:
   ```bash
   npx wrangler d1 create zou-ba-db
   ```
2. Copy the returned `database_id` into [`wrangler.jsonc`](./wrangler.jsonc).
3. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
4. Apply the schema:
   ```bash
   npm run dev
   npx wrangler d1 migrations apply zou-ba-db --local
   npx wrangler d1 migrations apply zou-ba-db --remote
   ```
5. Deploy:
   ```bash
   npm run deploy
   ```
6. Set the frontend env var before running/exporting the app:
   ```bash
   EXPO_PUBLIC_API_BASE_URL="https://your-worker.your-subdomain.workers.dev"
   ```

## API

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/session`
- `POST /auth/logout`
- `GET /state`
- `PUT /state`
- `GET /leaderboard`

## Notes

- Passwords are stored as PBKDF2 hashes with random salts, never in plain text.
- Sessions are stored as hashed bearer tokens.
- The frontend still keeps a local copy so the app remains usable offline.
- Each account keeps its current state plus at most three recovery snapshots. A snapshot is made only on a changed save, at most once per 24 hours, and expires after seven days.
- Identical content (including retries that only change sync timestamps) does not rewrite state or create history. Real progress and settings changes still save immediately.
- State updates and snapshot retention run in one transaction. Conflicting device saves re-read and merge before retrying.
- Daily maintenance at 03:00 UTC removes expired snapshots, sessions, and authentication attempts. Session activity timestamps update at most once per 15 minutes.
- Apply `0003_bound_state_history.sql` to clean up existing unbounded history before deploying the retention update. Current progress, accounts, and active sessions are preserved. Capture a D1 Time Travel bookmark before production maintenance: `npx wrangler d1 time-travel info zou-ba-db`.
- Run `npm test` with Node 22.13+ (Node 24 recommended). Storage tests execute the actual queries against SQLite, including transaction rollback and concurrent-save checks.
