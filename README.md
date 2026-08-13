# Axinfra Mobile

iOS/Android client for Axinfra. Built with Expo (React Native + TypeScript,
Expo Router). This app talks to the **same production API and database** as
the Axinfra web app — it has no backend or database of its own, and never
touches Postgres/Prisma directly. See `MOBILE_APP_SETUP.md` in the web repo
for the full architecture writeup.

## Status

Early skeleton: auth flow (login → token stored in device Keychain/Keystore
via `expo-secure-store` → attached as `Authorization: Bearer` on every
request) and a placeholder authenticated home screen that reads
`GET /api/projects`. Not yet wired to production — see "Backend dependency"
below.

## Backend dependency

The web API currently only accepts the `session` cookie for auth. This app
needs the API to also accept `Authorization: Bearer <token>` and to return
`{ token, user }` from `POST /api/auth/login` — that's a small, additive
change on the web repo's side (§3.1 in `MOBILE_APP_SETUP.md`), not yet
deployed. Until it ships, requests from this app to a real API will fail auth.

## Local setup

```bash
npm install
cp .env.example .env   # then edit EXPO_PUBLIC_API_URL — see comments in the file
npx expo start
```

Then pick a target from the Expo CLI output: iOS Simulator, Android Emulator,
a physical device via Expo Go, or `w` for web.

`EXPO_PUBLIC_API_URL` notes:

- iOS Simulator can reach the web repo's `npm run dev` at `http://localhost:3000` directly.
- Android Emulator must use `http://10.0.2.2:3000` instead of `localhost`.
- A physical device must use your machine's LAN IP (e.g. `http://192.168.1.23:3000`).
- Point at `https://your-app.vercel.app` to test against production once the
  Bearer-auth backend change is live.

## Project structure

```
src/
├── app/            ← Expo Router screens (file-based routing)
│   ├── _layout.tsx  ← providers (React Query, Auth) + auth-gated navigation
│   ├── login.tsx    ← email/password sign-in
│   └── index.tsx    ← authenticated home screen (placeholder)
├── components/      ← shared UI primitives (ThemedText, ThemedView, AuthGate)
├── lib/
│   ├── api.ts        ← fetch wrapper — attaches the stored session token
│   ├── auth.tsx       ← AuthContext: login/logout, session restore on launch
│   └── query-client.ts ← shared React Query client (caching, retry policy)
├── constants/        ← theme tokens (colors, spacing, fonts)
└── hooks/             ← color-scheme detection
```

## Build & release

```bash
npm install -g eas-cli
eas login
eas build:configure

eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

Requires an Apple Developer account and a Google Play Developer account —
see `MOBILE_APP_SETUP.md` §7 in the web repo for details.
