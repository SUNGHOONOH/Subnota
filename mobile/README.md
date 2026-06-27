# Subnota Mobile (iOS)

This directory contains the React Native client application for iOS, utilizing MMKV for local storage and a React Tiptap editor rendering through an offline WebView bundle.

## Bottom Navigation Tabs
The client implements three bottom navigation tabs:
1. `노트` (Memos)
2. `캘린더` (Calendar)
3. `수집함` (Inbox)

## Environment Setup

Create `mobile/.env`:
```text
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
MEMO_BACKEND_URL=http://localhost:8000
```

*For physical iPhone testing, set `MEMO_BACKEND_URL` to your Mac's local network IP address:*
```text
MEMO_BACKEND_URL=http://192.168.x.x:8000
```

## Getting Started

1. Install dependencies:
   ```sh
   corepack pnpm install
   ```

2. Start the Metro bundler:
   ```sh
   corepack pnpm start --reset-cache
   ```

3. Run on iOS Simulator:
   ```sh
   corepack pnpm ios
   ```

## Local-First & Sync Rules
* Memo writing and manual calendar logging are fully active offline without authentication.
* Local changes are persisted immediately via Zustand MMKV store adapters.
* Data synchronization initiates automatically via the Supabase Client once session credentials become available.

## Verification

* **TypeScript Compilation**:
  ```sh
  corepack pnpm -s tsc --noEmit
  ```

* **Jest Unit Tests**:
  ```sh
  corepack pnpm -s jest --runInBand
  ```
