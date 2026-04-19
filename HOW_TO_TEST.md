# How to Test Your App Locally

This project is web-only.

## Local Preview

1. Open your terminal in the project folder.
2. If you want to test cloud auth/sync, start the backend in another terminal:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
3. In the frontend terminal, set the backend URL and start Expo:
   ```bash
   EXPO_PUBLIC_API_BASE_URL="http://127.0.0.1:8787" npm run web
   ```
4. Open the local URL shown by Expo, usually `http://localhost:8081`.
5. Open the Settings tab and create an account to verify signup, login, logout, and sync.

If you only want guest-mode local persistence, you can still run:

```bash
npm run web
```

## Production Export

To generate the static web build, run:

```bash
npm run export:web
```

The exported files will be written to `dist/`.
