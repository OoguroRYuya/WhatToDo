# Daybook: Digital To-Do & Note Manager

An offline-first to-do and notes app for **React Native (Expo SDK 58)**. Data lives in SQLite on the phone, backs up to Firebase on request, shows a daily quote from a public API, and can lock notes with a PIN (AES-256 encryption).

The requirements are in [`../Requirement.md`](../Requirement.md). The UI follows the **Hallmark** design skill ([`../.claude/skills/hallmark`](../.claude/skills/hallmark)) with the *Dose* theme.

## Run it

```bash
cd project
npm install
cp .env.example .env        # then fill in your Firebase web config
npx expo start              # scan the QR code with Expo Go
```

### Firebase setup (one time)

1. Create a project at https://console.firebase.google.com.
2. **Authentication → Sign-in method →** enable *Email/Password*.
3. **Firestore Database →** create a database, then paste [`firestore.rules`](firestore.rules) into *Rules* and publish.
4. **Project settings → Your apps →** add a *Web app* and copy its config into `.env`.

Without `.env` the app still opens and says Firebase is not set up yet.

## Structure

```
src/
  app/                    Expo Router: every file is a screen (Activity), _layout files are navigators
    _layout.tsx           fonts, SQLite, auth and toast providers; route guard (Stack.Protected)
    sign-in.tsx           Auth screen: sign in and register
    (tabs)/_layout.tsx    bottom tabs
    (tabs)/index.tsx      Home/Dashboard: quote, summary, To-do and Notes lists
    (tabs)/profile.tsx    Profile & Sync: account, Backup, Restore, Sign out
    editor.tsx            Add/Edit: to-do or note, PIN lock
  components/             reusable pieces (Fragments): Button, TextField, PinSheet, SyncStamp, rows, states
  context/                AuthContext (Firebase Auth), ToastContext
  lib/
    db.ts                 SQLite schema, migrations, parameterised queries
    sync.ts               Backup/Restore with Firestore, last-write-wins, tombstones
    crypto.ts             PBKDF2 → AES-256-CBC + HMAC-SHA256 (encrypt-then-MAC)
    pin.ts                PIN verifier in expo-secure-store, attempt limiting
    quotes.ts             ZenQuotes → DummyJSON fallback, timeout, daily cache in SQLite
    validation.ts         input checks and sanitising
    firebase.ts           Firebase Web SDK init, auth persistence
  theme/tokens.ts         design tokens (Hallmark stamp at the top)
firestore.rules           security rules: each user reads and writes only users/{uid}/…
```

## Requirement mapping

| Requirement | Where |
|---|---|
| FR-01 register and sign in | `app/sign-in.tsx`, `context/AuthContext.tsx` |
| FR-02 external API on the dashboard | `lib/quotes.ts`, `components/QuoteCard.tsx` |
| FR-03 to-do CRUD and mark done | `lib/db.ts`, `app/(tabs)/index.tsx`, `app/editor.tsx` |
| FR-04 notes CRUD | same |
| FR-05 PIN-encrypted notes | `lib/crypto.ts`, `lib/pin.ts`, `components/PinSheet.tsx` |
| FR-06 backup and restore | `lib/sync.ts`, `app/(tabs)/profile.tsx` |
| 3.1 sync status indicator | `components/SyncStamp.tsx`, the cloud icon on unsynced rows |
| 3.6 FlatList lazy loading | `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, memoised rows |
| 3.6 API caching | `api_cache` table plus an in-memory copy, valid for the local day |
| 3.6 route protection | `Stack.Protected` in `app/_layout.tsx` |
| 3.6 input validation | `lib/validation.ts`; every SQL query binds parameters |

### Schema additions beyond Requirement.md 3.3

- `is_deleted` on both tables (tombstones). Without it a deleted item could never be removed from the cloud, and Restore would bring it back.
- `created_at` on both tables, for a stable list order.
- `api_cache` and `meta` tables (quote cache, last backup time).

## Checks

```bash
npx tsc --noEmit     # typecheck
npx expo lint        # ESLint (installed with --legacy-peer-deps, see below)
npx expo-doctor      # 20/20 at the time of writing
```

`npm install` may report a peer conflict between `react@19.3.0` and the `react-dom@19.3.1` that expo-router's web dependencies pull in. It affects web only. If npm refuses to install, use `npm install --legacy-peer-deps`.
