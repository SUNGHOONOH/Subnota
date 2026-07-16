# Subnota Desktop

Subnota desktop app for macOS and Windows, built with Electron 42, React 19,
Tiptap, and SQLite. The renderer and application features share one codebase;
platform policy is defined in `src/platform/policy.ts`.

This app uses Node's native `DatabaseSync` in a background worker thread (`local-database.ts`) for local-first storage, replacing the legacy `localStorage` engine.

## Download

Subnota desktop releases must use a Subnota-owned GitHub release repo. Do not publish or auto-update from any upstream release channel.

- **macOS install** — download the `.dmg` file
- **macOS native updates** — publish the generated `.zip` and `RELEASES.json` assets from the same release
- **Windows install** — download the Squirrel Setup `.exe` file

## Environment Setup

Create an `.env` file in the `desktop` directory from `.env.example` and fill
in the endpoints for the target environment:
```text
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_MEMO_BACKEND_URL=http://localhost:8000
```

Start from `.env.example`; never commit the populated `.env` file.

## Development

Install dependencies and start the Electron Forge + Vite dev server (HMR):
```bash
pnpm install
pnpm start
```

## Scripts

### Build

```bash
pnpm build:mac
pnpm build:windows
```

Windows installer builds must run on Windows. The CI workflow verifies both
platforms independently.

### Release

```bash
pnpm release -- "What's new in this release"
pnpm release:mac -- "What's new in this release"
pnpm release:windows -- "What's new in this release"
```

`pnpm release` selects the current operating system automatically. The macOS
release publishes the DMG, update ZIP, and `RELEASES.json`. The Windows release
publishes the Squirrel Setup EXE.

## Platform policy

- Mini Subnota and its global shortcut are available on macOS and Windows.
- The main Inbox, including manual URL capture, is available on both platforms.
- Native current-browser-page capture and recent captures in the tray are
  macOS-only.
- The Windows browser-extension clipper is reserved for a later release.

Agent-facing architecture and UI invariants are documented in
`docs/CODEMAP.md`, `docs/design.md`, and `CLAUDE.md`.

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
