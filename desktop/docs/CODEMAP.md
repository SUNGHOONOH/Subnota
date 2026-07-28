# Subnota Desktop Code Map

Last verified: 2026-07-28

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
| `src/local-embedding.ts` | On-device embeddings via ONNX Runtime (Transformers.js, `Xenova/bge-m3` q8). Model download/cache, separate interactive vs background-index sessions, `local-embed:*` IPC. |

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
| `src/features/schedule/ScheduleInboxWorkspace.tsx` | Schedule inbox and recommendations. Renamed from `BriefingWorkspace`; briefings themselves remain iOS-only. |
| `src/features/search/GlobalSearchOverlay.tsx` | Cross-surface search overlay. |
| `src/features/search/LocalIndexProgress.tsx` | First-run local index progress and model download state. |
| `src/features/preview/PreviewPanel.tsx` | Read-only preview panel for *reference* opens. Third `.app-shell` grid column, so it is independent of the split-pane count. |
| `src/features/settings/SettingsModal.tsx` | Account, theme, storage and platform-available shortcuts. |
| `src/features/mini/MiniComposer.tsx` | Shared Mini quick memo renderer. |
| `src/features/tree/**` | Completion-derived growing tree and forest UI/model. |

`src/App.tsx` caps split panes at two. A pane can host multiple editor/view tabs.
Opening a source detail appends or focuses its source tab rather than replacing
the originating tab.

### Navigate vs reference opens

Every "open something" path is one of two kinds, and they land on different
surfaces. Getting this wrong is the most common regression here.

| Kind | Meaning | Lands on |
| --- | --- | --- |
| **Navigate** | The target *is* the destination — you are going there to work. | New tab in the **focused** pane (existing behavior). |
| **Reference** | You are comparing the target against what you are already looking at. | The **preview panel**. |

Reference opens (7): ambient top result, ambient more-results list, KNN
neighbour graph nodes (memo and source), Topics chips, Topics graph inbox
nodes, and the calendar's "open source note". They call `onOpenPreview`, which
`src/App.tsx` turns into preview-panel state. The panel is reused rather than
stacked, so clicking through a graph never accumulates panels.

Navigate opens (12) keep using `openMemoInFocusedSplitPane`, `openViewAsTab`,
`openMemoInPane` and `openSourceInPane`. A reference open must never take over
the focused pane — that would hide the thing the user was comparing against.

Promotion (`⧉` in the preview header) is the one place that inverts the pane
choice: with two panes it opens in the **non-focused** pane so the draft stays
visible, and it never moves focus. With one pane it opens a tab in that pane —
the app does not create splits on the user's behalf.

Custom events keep the two intents apart: `subnota:preview-memo` opens the
panel, `subnota:open-memo` / `subnota:open-inbox-source` open real tabs and
accept `detail.target: 'beside' | 'focused'`.

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
| `src/services/local/localMemoIndexer.ts` | Chunks memos and writes vectors to the local index. Filters noise chunks with `isMeaningfulChunk`. |
| `src/services/local/localMemoSearch.ts` | Local cosine search over `local_memo_chunk_vectors`, excluding the current memo and near-duplicates. |
| `src/services/local/localInboxIndexer.ts` | Same, for saved web summaries. |

### Ambient Mirror (local embeddings)

Ambient search runs entirely on-device — no network, no per-query cost.

```text
editor update → ambientIdle picks a delay by writing stage
              → local-embed:embed (ONNX, one text at a time)
              → localMemoSearch over local SQLite vectors
              → ghost line under the editor
              → ⌘↩ / ⌘⇧↩ or click → preview panel
```

Two invariants live in code comments and regression tests. Do not undo them:

- **Never batch embeddings.** Passing an array to Transformers.js lets padding
  leak into the CLS position, so the same sentence yields a different vector
  (measured cosine 0.978–0.992). Index and query vectors must share one space.
- **`EMBEDDING_MODEL_ID` gates the local index.** Changing model, engine or
  quantization invalidates every stored vector; the signature column exists so
  stale vectors are discarded rather than silently mixed.

Trigger delays come from the writing stage rather than a single idle timer,
because a 2s pause lands on someone still composing (keystroke-logging research
puts the transcription/planning boundary at ~2000ms):

| Stage | Delay | Query |
| --- | --- | --- |
| Cursor in a heading | 1.5s | The heading text |
| Current block empty (just pressed Enter) | 2s | The previous sibling block |
| Text before the cursor ends at a sentence boundary | 2s | Cursor sentence ±1 |
| Otherwise | 5s | Cursor sentence ±1 |

The "previous sibling" lookup walks up the ancestor chain rather than reading
the document's top level, because roughly half of real chunks sit inside list
items, where the top-level index points at the whole list.

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
| `forge.config.ts` | Platform makers, macOS signing/notarization, protocol registration, fuses, and the runtime-dependency allowlist that ships `onnxruntime-node` (see below). |
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
- `ambient-idle.test.ts` — writing-stage trigger branches, including list nesting.
- `local-embedding.test.ts` — IPC contract, single-text embedding, index/interactive session split.
- `preview-panel.test.tsx` — highlight recovery when indices drift, list/detail modes.
- `hotkey-hint.test.ts` — ambient shortcuts registered and conflict-free.
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
