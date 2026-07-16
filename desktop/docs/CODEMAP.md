# Subnota Desktop Code Map

Last verified: 2026-07-14

This document maps the active unified Electron app in `desktop/`. The legacy
`macos/` and `windows/` folders are migration safety copies, not sources to
edit or merge back into the app.

## Non-negotiable architecture decisions

- One source tree builds macOS and Windows.
- macOS is the canonical shared UI/UX baseline.
- Platform policy is centralized in `src/platform/policy.ts`.
- Renderer UI and SCSS stay shared. Platform branches expose or hide only
  approved platform capabilities.
- Mini Subnota and the main Inbox work on both platforms.
- Windows defers automatic current-browser capture, not manual Inbox URLs.
- Local-first writes reach SQLite before optional remote synchronization.

## Top-level entry points

| Path | Responsibility |
| --- | --- |
| `package.json` | Shared scripts and dependency versions for both platforms. |
| `forge.config.ts` | Vite builds, Electron fuses, macOS DMG/ZIP/signing, Windows Squirrel maker. |
| `vite.main.config.ts` | Main-process bundle configuration. |
| `vite.preload.config.ts` | Preload bundle configuration. |
| `vite.renderer.config.ts` | React renderer bundle and `@/` alias. |
| `src/main.ts` | Native application lifecycle and all privileged behavior. |
| `src/preload.ts` | Narrow typed bridge exposed as `window.electronAPI`. |
| `src/renderer.tsx` | React bootstrap; selects main or Mini surface. |
| `src/App.tsx` | Main renderer state, auth, sync, navigation, and workspace orchestration. |
| `src/index.scss` | Global stylesheet entry point. |
| `src/platform/policy.ts` | Sole platform capability matrix. |

## Process boundary

```text
Electron main (`main.ts`)
  ├─ native windows, menu/tray, shortcuts, files, OAuth, updates
  ├─ SQLite worker (`local-database.ts`)
  └─ typed IPC handlers
          ↓
Preload (`preload.ts`)
  └─ limited `window.electronAPI`
          ↓
React renderer (`renderer.tsx` → `App.tsx`)
  ├─ shared application UI
  └─ Mini renderer (`features/mini/MiniComposer.tsx`)
```

Renderer files must not bypass preload with Electron, filesystem, shell, or
raw IPC access.

## Main-process modules

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | BrowserWindow creation, native menu/tray, close behavior, second-instance/deep-link dispatch, IPC, OAuth, Mini and update setup. |
| `src/local-database.ts` | `node:sqlite` `DatabaseSync` work on a worker thread, WAL, storage location, backup and restore. |
| `src/mini-subnota.ts` | Mini window positioning/toggling, shortcut registration, recent items and macOS AppleScript capture. |
| `src/deep-link.ts` | Pure parser for `subnota://memo` and `subnota://capture`. Routing permission remains in platform policy. |
| `src/auto-updater.ts` | Packaged macOS Squirrel.Mac native update feed. Returns inactive on Windows. |
| `src/update-checker.ts` | GitHub latest-release fallback; selects DMG on macOS and Setup EXE on Windows. |
| `src/window-close-handler.ts` | Waits for renderer save/flush before closing. |
| `src/handle-file-drop.ts` | Validates and opens dropped Markdown files. |

## Platform capability matrix

The code source of truth is `src/platform/policy.ts`.

| Feature flag | macOS | Windows | Effect |
| --- | --- | --- | --- |
| `miniSubnota` | true | true | Shared floating quick-memo surface. |
| `trayQuickMemo` | true | true | Menu bar or notification-area entry. |
| `webInbox` | true | true | Main Inbox remains available. |
| `manualLinkCapture` | true | true | Pasted URLs save, sync, render, and open. |
| `nativeCurrentPageCapture` | true | false | AppleScript active-tab capture is macOS-only. |
| `captureShortcut` | true | false | Windows hides and does not register capture shortcut. |
| `recentCapturesInTray` | true | false | Windows omits recent-capture native/Mini UI. |
| `webClipperDeepLinks` | true | false | Windows ignores unreleased capture deep links. |
| `browserExtensionClipper` | false | false | Reserved for later work. |

Do not infer that `webInbox: true` enables browser capture. Manual Inbox entry
and automatic browser capture are separate capabilities.

## Renderer workspaces

| Path | Responsibility |
| --- | --- |
| `src/features/auth/AuthScreen.tsx` | Account and OAuth entry. |
| `src/features/memo/MemoWorkspace.tsx` | Memo list/editor and related content. |
| `src/features/memo/components/MemoSplitWorkspace.tsx` | Shared two-pane shell, tab strips, editor/view tabs, resizers and focused toolbar. |
| `src/features/memo/components/KnowledgeGraphView.tsx` | Memo/topic/source relationship graph. |
| `src/features/memo/components/SourceDetailPane.tsx` | Saved web-source detail view. |
| `src/features/calendar/CalendarWorkspace.tsx` | Week/month calendar and completion flows. |
| `src/features/inbox/InboxWorkspace.tsx` | Manual URL form, local/remote saved items and source opening. |
| `src/features/briefing/BriefingWorkspace.tsx` | Briefings and schedule recommendations. |
| `src/features/search/MemoSearchModal.tsx` | Local MiniSearch-based memo search. |
| `src/features/settings/SettingsModal.tsx` | Account, theme, storage and platform-available shortcuts. |
| `src/features/mini/MiniComposer.tsx` | Shared Mini quick memo renderer. |
| `src/features/tree/**` | Completion-derived growing tree and forest UI/model. |

`src/App.tsx` caps split panes at two. A pane can host multiple editor/view tabs.
Opening a source detail appends or focuses its source tab rather than replacing
the originating tab.

## Editor

| Path | Responsibility |
| --- | --- |
| `src/components/tiptap-templates/simple/simple-editor.tsx` | Main Tiptap React editor shell and editor event integration. |
| `src/components/tiptap-ui/**` | Editor actions, dropdowns, popovers and toolbar controls. |
| `src/components/tiptap-ui-primitive/**` | Reusable editor UI primitives. |
| `src/components/tiptap-node/**` | Code, image, table, frontmatter and other node extensions. |
| `src/components/tiptap-extension/**` | Custom Tiptap extensions. |
| `src/components/tiptap-icons/**` | Shared SVG icon components. |
| `src/lib/tiptap-utils.ts` | Markdown conversion and editor helpers. |

The Electron renderer embeds Tiptap React directly; it does not use the mobile
React Native WebView bridge.

## Local-first data and sync

| Path | Responsibility |
| --- | --- |
| `src/services/local/offlineStore.ts` | Local memos, calendar, Inbox queue, completion/tree data and SQLite persistence facade. |
| `src/services/supabase/client.ts` | Supabase anon client configuration. |
| `src/services/supabase/data.ts` | Remote data fetch/upsert functions. |
| `src/services/supabase/memoSync.ts` | Memo sync and conflict behavior. |
| `src/services/backend/inboxService.ts` | Inbox metadata/summary backend client. |
| `src/services/backend/networkService.ts` | Network search backend client. |

### Memo/calendar flow

```text
user edit → App/workspace state → offlineStore/SQLite
                                → pending sync when session/network is available
                                → Supabase
```

### Manual Inbox flow on both platforms

```text
paste URL in InboxWorkspace
  → App save handler
  → local Inbox queue first
  → backend metadata/summary when available
  → remote sync
  → saved item can be read/opened in the shared Inbox UI
```

### macOS automatic browser capture

```text
menu/tray/shortcut/deep link
  → main.ts platform guard
  → mini-subnota.ts AppleScript capture
  → renderer inbox-capture event
  → the same Inbox save path
```

Windows does not enter the automatic flow.

## Styling and design sources

| Path | Responsibility |
| --- | --- |
| `src/styles/_color-tokens.scss` | Semantic light/dark application colors. |
| `src/styles/_variables.scss` | Tiptap-compatible base colors, radii, shadows and transitions. |
| `src/styles/subnota-workspace.scss` | Shared desktop layout, typography, dimensions, components and responsive rules. |
| `src/lib/colorTokens.ts` | TypeScript/Mantine color values. |
| `src/lib/mantineTheme.ts` | Mantine mapping for brand, fonts, radii and shadows. |
| `src/features/mini/MiniComposer.scss` | Shared Mini presentation. |
| `src/components/**.scss` | Colocated editor component styles. |

The human-facing rules and parity checklist are in `docs/design.md`.

## Packaging and release

| Path | Responsibility |
| --- | --- |
| `forge.config.ts` | Platform makers, macOS signing/notarization, protocol registration and fuses. |
| `build/entitlements.mac.plist` | Apple Events and JIT entitlements. |
| `scripts/build-dmg.sh` | Local macOS package, entitlement-preserving ad-hoc resign and DMG. |
| `scripts/release.sh` | Signed/notarized macOS DMG + ZIP + `RELEASES.json` release. |
| `scripts/build-exe.mjs` | Windows Squirrel Setup build. |
| `scripts/release-windows.mjs` | Windows release upload/create flow. |
| `scripts/release-platform.mjs` | Dispatches release command by host OS. |
| `../.github/workflows/desktop-unified.yml` | Repository-level macOS/Windows matrix checks and native builds. |

## Tests that protect the merge

- `platform-policy.test.ts` — capability matrix.
- `windows-platform-main.test.ts` — Windows tray/Mini and no-capture wiring.
- `mini-subnota-position.test.ts` — placement and shared shortcut registration.
- `mini-subnota-capture.test.ts` — macOS browser capture parsing.
- `second-instance-deep-link.test.ts` — macOS capture deep-link routing.
- `update-checker.test.ts` — DMG/Setup EXE asset selection.
- `auto-updater.test.ts` — macOS native update feed.
- `offline-store.test.ts` — local-first persistence.
- `window-close-handler.test.ts` — save-before-close behavior.

Run the full suite before deleting legacy folders. Windows installation and UI
parity still require a real Windows host; CI compilation alone is insufficient.

## Legacy-folder removal gate

Do not delete `macos/` or `windows/` until all are true:

1. `desktop/.env` has been created with the intended environment values.
2. Type-check, full tests and lint pass from `desktop/`.
3. macOS DMG builds and launches with capture entitlements intact.
4. Windows Setup EXE builds, installs, launches and updates on Windows.
5. Main UI screenshots/flows match the macOS baseline except approved policy
   differences.
6. Mini quick memo and manual Inbox URL flows pass on both platforms.
7. The unified CI has succeeded before the legacy CI is removed.
