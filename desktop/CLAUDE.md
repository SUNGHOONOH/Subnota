# CLAUDE.md

This file is the agent guide for the unified Subnota Electron desktop app.
It replaces the legacy platform-folder guides. Read `docs/CODEMAP.md` and
`docs/design.md` before changing architecture or UI.

## Working principles

- State assumptions and success criteria before non-trivial changes.
- Implement the smallest change that solves the requested problem.
- Keep edits surgical; do not clean up unrelated code.
- For bugs, add a regression test before or with the fix.
- Prefer `pnpm` for dependency and script commands.
- Do not delete or rewrite user data, local `.env` files, or legacy folders
  without explicit approval and a completed migration check.

## Canonical source and UI invariant

- `desktop/` is the only active macOS/Windows desktop source tree.
- The current macOS implementation is the canonical UI/UX baseline.
- Shared renderer components, layout, typography, spacing, colors, motion, and
  styles must remain identical on macOS and Windows.
- Do not restore UI or state logic from the legacy `windows/` folder. It was
  behind macOS and is retained only as a migration safety copy.
- Do not create platform-specific copies of renderer components or SCSS.
- Platform differences must be the smallest possible feature exposure branch,
  driven by `src/platform/policy.ts`.
- Before accepting a renderer change, compare it against the macOS behavior and
  verify that no unrelated visual or interaction change was introduced.

The only approved visible platform differences are listed below. Everything
else is shared and must look and behave the same.

## Platform policy

| Capability | macOS | Windows |
| --- | --- | --- |
| Main memo/calendar/inbox/briefing UI | Yes | Yes, identical shared UI |
| Manual URL entry in Inbox | Yes | Yes |
| Existing Inbox sync/read/open flows | Yes | Yes |
| Mini Subnota quick memo | Yes | Yes |
| System surface | Menu bar | Notification-area tray |
| Mini global shortcut | Yes | Yes |
| Current browser page capture | AppleScript | Not released |
| Capture global shortcut | Yes | Hidden/not registered |
| Recent captures in tray/Mini | Yes | Hidden |
| `subnota://capture` routing | Yes | Ignored |
| Browser-extension clipper | Not released | Later release |
| Installer | DMG + ZIP update feed | Squirrel Setup EXE |

Windows policy does not disable the main Inbox. A user must still be able to
paste a URL manually, save it locally, sync it, read it, and open it. Only the
automatic active-browser capture surface is deferred.

## Commands

- `pnpm install --frozen-lockfile` — install the committed dependency graph.
- `pnpm start` — launch Electron Forge + Vite development mode.
- `pnpm exec tsc --noEmit` — type-check main, preload, and renderer code.
- `pnpm test` — run the Vitest suite.
- `pnpm lint` — run ESLint.
- `pnpm build:mac` — build the local macOS DMG.
- `pnpm build:windows` — build the Squirrel EXE; run on Windows.
- `pnpm release:mac` — signed/notarized macOS release pipeline.
- `pnpm release:windows` — Windows release pipeline.

Run the checks relevant to the change. UI/platform-policy changes require at
least type-checking and the platform, Mini, and main-process tests. Packaging
changes require the matching real platform build.

## Runtime architecture

- `src/main.ts` is the Electron main process: windows, native menu/tray,
  lifecycle, IPC, file open/save, OAuth, shortcuts, Mini, deep links, and update
  wiring.
- `src/preload.ts` is the narrow `contextBridge` boundary. Renderer code must
  not import Electron, Node filesystem, or raw IPC APIs.
- `src/renderer.tsx` selects the main app or Mini renderer.
- `src/App.tsx` orchestrates authentication, local-first data, remote sync,
  navigation, settings, and the two-pane workspace.
- `src/local-database.ts` owns SQLite access on a worker thread.
- `src/services/local/offlineStore.ts` is the renderer-facing local-first data
  layer and must remain the first write path for supported offline actions.
- `src/features/memo/components/MemoSplitWorkspace.tsx` renders the shared
  desktop workspace and its editor/view tabs.
- `src/components/tiptap-templates/simple/simple-editor.tsx` is the shared
  Tiptap editor shell.

See `docs/CODEMAP.md` for the full path map and data flows.

## UI and styling rules

- Read `docs/design.md` before changing visible UI.
- Global semantic colors live in `src/styles/_color-tokens.scss`.
- Shared size, radius, typography, motion, and compatibility tokens live in
  `src/styles/subnota-workspace.scss` and `src/styles/_variables.scss`.
- Mantine mappings live in `src/lib/mantineTheme.ts` and
  `src/lib/colorTokens.ts`.
- Feature styles may be colocated, but must consume shared tokens where a token
  exists.
- Never solve a Windows visual issue by copying an old Windows component or
  stylesheet. Fix the shared component unless the difference is explicitly in
  the platform-policy table.
- Preserve keyboard labels appropriate to the OS (`⌘` on macOS, `Ctrl` on
  Windows) without changing component geometry or visual hierarchy.

## Security and environment

- The renderer receives only the APIs declared by `src/preload.ts` and
  `src/types/electron.d.ts`.
- Keep `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and
  `webSecurity: true`.
- External URL opening stays restricted in the main process.
- Client configuration uses `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, and `VITE_MEMO_BACKEND_URL`.
- Never commit `.env` or server-only secrets.
- Never put service-role, Gemini, HF, YouTube, or admin keys in the Electron
  bundle.

## Platform implementation notes

- Read feature flags through `DESKTOP_PLATFORM_FEATURES` in the main/preload
  process or `window.electronAPI.getPlatformFeatures()` in the renderer.
- macOS may use `hiddenInset`, Apple Events entitlements, AppleScript capture,
  menu-bar recent captures, Squirrel.Mac, DMG, and ZIP.
- Windows uses native window chrome, notification-area tray behavior, Squirrel
  Setup EXE, and the GitHub release checker fallback.
- Mini Subnota is shared. Do not disable it on Windows.
- Keep Windows close-to-tray preference behavior intact.
- Do not implement the deferred browser extension unless explicitly requested.

## Migration safety

- `macos/` and `windows/` are read-only safety copies until Windows EXE install
  and visual parity have been verified.
- Do not delete either folder or the legacy macOS CI workflow yet.
- The old `docs/` and `CLAUDE.md` files inside those folders are historical and
  must not override these unified documents.
- The populated environment values still require a local `desktop/.env`; use
  `.env.example` as the key list.
