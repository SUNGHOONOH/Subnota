# Subnota macOS

Subnota macOS desktop app built with Electron 42, React 19, Tiptap, and SQLite.

This app uses Node's native `DatabaseSync` in a background worker thread (`local-database.ts`) for local-first storage, replacing the legacy `localStorage` engine.

## Download

Subnota desktop releases must use a Subnota-owned GitHub release repo. Do not publish or auto-update from any upstream release channel.

- **macOS install** — download the `.dmg` file
- **macOS native updates** — publish the generated `.zip` and `RELEASES.json` assets from the same release

## Environment Setup

Create an `.env` file in the `macos` directory if custom endpoints are needed (defaults to production endpoints):
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

Runs locally and publishes the current `package.json` version:
1. **Tests** — runs `pnpm test` unless `SKIP_TESTS=1`
2. **Build** — runs Electron Forge makers for DMG plus Squirrel.Mac ZIP/`RELEASES.json`
3. **Tag** — creates and pushes `vX.Y.Z`
4. **GitHub release** — uploads the DMG, ZIP, and `RELEASES.json`

If a release note is passed, it becomes the GitHub release body verbatim.

### Build DMG (local only)

```bash
pnpm run build:dmg
```

Builds the DMG without bumping the version or publishing. Useful for local testing.

## Verification & Testing

* **Vitest Unit Tests**:
  ```sh
  pnpm test
  ```

* **ESLint Check**:
  ```sh
  pnpm run lint
  ```
