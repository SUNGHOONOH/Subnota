# Subnota Windows

Subnota Windows desktop app built with Electron 42, React 19, Tiptap, and SQLite.

This app uses Node's native `DatabaseSync` in a background worker thread (`local-database.ts`) for local-first storage, replacing the legacy `localStorage` engine.

## Download

Subnota desktop releases must use a Subnota-owned GitHub release repo. Do not publish or auto-update from any upstream release channel.

- **Windows install** — download the Squirrel `.exe` setup file

Windows currently checks GitHub releases for a newer Setup EXE and opens the download link. It does not use the macOS Squirrel.Mac `RELEASES.json` native updater path.

### Windows: SmartScreen warning

The Windows installer is not code-signed yet, so Windows SmartScreen may show a warning on first launch. To proceed:
1. Click **"More info"**
2. Click **"Run anyway"**

## Environment Setup

Create an `.env` file in the `windows` directory if custom endpoints are needed (defaults to production endpoints):
```text
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
MEMO_BACKEND_URL=http://localhost:8000
```

## Development

Install dependencies and start the Electron Forge + Vite dev server (HMR):
```bash
pnpm install
pnpm start
```

## Scripts

### Release

```bash
pnpm run release
# or with a custom release note:
pnpm run release -- "What's new in this release"
```

Runs locally on Windows and publishes the current `package.json` version:
1. **Tests** — runs `pnpm test` unless `SKIP_TESTS=1`
2. **Build** — runs the Electron Forge Squirrel maker through `scripts/build-exe.mjs`
3. **GitHub release** — uploads the generated setup `.exe`

If a release note is passed, it becomes the GitHub release body verbatim.

### Build EXE

```bash
pnpm run build:exe
```

Builds the Windows Squirrel installer without publishing. This must run on Windows unless `FORCE_WINDOWS_MAKE=1` is explicitly set in a configured cross-build environment.

## Verification & Testing

* **Vitest Unit Tests**:
  ```sh
  pnpm test
  ```

* **ESLint Check**:
  ```sh
  pnpm run lint
  ```
