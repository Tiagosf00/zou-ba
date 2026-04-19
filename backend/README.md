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
2. Copy the returned `database_id` into [`backend/wrangler.jsonc`](/mnt/c/Users/tiago/Desktop/git/zou-ba/backend/wrangler.jsonc).
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

## Notes

- Passwords are stored as PBKDF2 hashes with random salts, never in plain text.
- Sessions are stored as hashed bearer tokens.
- The frontend still keeps a local copy so the app remains usable offline.
