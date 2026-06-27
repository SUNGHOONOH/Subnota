# Subnota

Local-first memo app for quick capture, manual calendar blocks, URL inbox, daily briefing, and cursor-based memo networking. iOS runs on React Native; the macOS and Windows desktop apps are Electron + Tiptap.

## Current Architecture

Subnota is split by platform:

- **iOS** is the React Native app in `mobile/`, with bottom tabs for `노트`, `캘린더`, `수집함`, and `브리핑`. Notes are edited through an offline Tiptap WebView bundle.
- **macOS and Windows** are Electron + Tiptap desktop apps (`macos/`, `windows/`) sharing ~95% of their code. They use SQLite (`node:sqlite` in a background worker thread) as local-first storage (replacing the legacy `localStorage`), and render a nav-rail workspace with a native Tiptap editor (no WebView bridge).
- All clients are local-first: calendar blocks, inbox fallback entries, and memo edits are saved locally first, then synced when Supabase auth is available.
- **Gamification & Growth**: Desktop clients feature a virtual tree/forest growth-event tracking ledger (based on calendar block completions) synced to Supabase.

The desktop apps are mid-migration from the legacy React Native macOS target (which has been removed from `mobile/macos/`) — see [`ELECTRON_MIGRATION_STATUS.md`](./ELECTRON_MIGRATION_STATUS.md).

Online enrichment is handled by a separate Python FastAPI backend:

- nightly schedule candidate extraction into `schedule_inbox`
- memo chunk indexing with Kiwi + Hugging Face embeddings
- cursor-based State B network search through pgvector
- State A topic discovery only when synced memos are marked dirty
- inbox URL analysis for YouTube, Instagram, and general web pages
- Gemini/Gemma structured summaries for saved external content
- daily maintenance that combines schedule inbox, memo indexing, and topic discovery

The app remains usable without login or network for memo writing, manual calendar registration, and local inbox fallback.

## Important Docs

- [Code map](./mobile/docs/CODEMAP.md): current file responsibilities and refactored paths (iOS/RN app)
- [Flow](./mobile/docs/flow.md): current runtime/data flow (iOS/RN app)
- [Backend README](./backend/README.md): backend setup and endpoint notes
- [macOS Electron release](./macos/docs/macos-release.md): DMG/native update distribution notes for the Electron macOS target

`mobile/docs/CODEMAP.md` is the source of truth for RN/backend file ownership; `macos/CLAUDE.md` and `windows/CLAUDE.md` cover the Electron desktop apps.

## Stack

**iOS (React Native, `mobile/`)**

- React Native CLI 0.81
- TypeScript
- Zustand persist with platform storage adapter
- Tiptap + React Native WebView for the memo editor
- Supabase client for optional sync, auth, inbox, briefing, and online graph data

**macOS & Windows desktop (Electron, `macos/` + `windows/`)**

- Electron 42.4.0 + Electron Forge 7.11.2 (Vite plugin)
- React 19.2 + Tiptap 3.26.1 (native browser editor, no WebView bridge)
- Vite 5.4.x, Vitest 3.2.6, TypeScript ~5.5
- Local-first storage backed by SQLite (using Node's native `DatabaseSync` in a background worker thread with WAL journaling enabled)
- Shares a unified Mini Subnota workspace (quick capture floating panel, global shortcuts) across macOS and Windows (browser active-tab capture is macOS-exclusive due to AppleScript dependencies)

**Legacy (removed)**

- React Native macOS 0.81 (previously `mobile/macos/`)

**Backend & data (shared)**

- Python FastAPI backend
- Kiwi / kiwipiepy for Korean sentence chunking
- Hugging Face Inference API for embeddings
- Supabase pgvector for chunk similarity search
- Gemini API for YouTube URL content summary and fallback summary generation
- Optional YouTube Data API for video metadata

## Repository Layout

```text
mobile/
  App.tsx
  src/
    app/                      # navigation and sync coordinator
    components/               # shared RN components
    features/
      auth/                   # login/signup UI and OAuth helpers
      memo/                   # memo screens, editor, graph UI, memo sync
      calendar/               # month/week calendar UI and calendar sync
      inbox/                  # saved link inbox UI and inbox API client
      briefing/               # briefing UI and briefing service
      network/                # State A/B online graph clients
    shared/
      native/                 # macOS menu bar bridge
      storage/                # platform storage adapter
      supabase/               # Supabase client and auth gate
    lib/                      # date, calendar, hash, chunk utility code
    store/                    # local-first Zustand store
  backend/
    app/
      api/                    # FastAPI routes and auth dependencies
      core/                   # config and constants
      db/                     # Supabase service-role data access
      features/               # inbox, memo, network, schedule, topics, maintenance
      shared/                 # backend shared helpers
      main.py                 # FastAPI app entry
  supabase/
    migrations/               # database schema and patches
    functions/                # daily briefing Edge Function

macos/                        # macOS desktop app — Electron Forge + Vite + Tiptap
windows/                      # Windows desktop app — ~95% shared with macos/
web/                          # marketing site (Next.js)
  app/
    components/               # modular, interactive landing page previews
      HeroMockup.tsx / .css
      CoreSchedulePreview.tsx / .css
      CoreMemoryPreview.tsx / .css
      NetworkGraphPreviews.tsx / .css
      DesktopFeaturePreviews.tsx / .css
    globals.css               # global styles (imports modular component CSS)
    page.tsx                  # simplified marketing page layout
```

## Local-First Rules

- Memo writing does not require login.
- Manual calendar registration does not require login.
- macOS menu bar capture can fall back to the local inbox queue.
- Supabase sync runs only when a user is signed in.
- Automatic schedule suggestions are online batch results, not realtime editor UI.
- State B network search requires login, backend URL, and indexed chunks.
- Inbox URL analysis requires login and backend access.
- Service role keys, HF tokens, Gemini keys, YouTube keys, and backend admin keys must never be placed in the app bundle.

## Environment

App `.env`:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
MEMO_BACKEND_URL=http://localhost:8000
```

Backend `backend/.env`:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
HF_TOKEN=
GEMINI_API_KEY=
YOUTUBE_API_KEY=
BACKEND_ADMIN_KEY=
BACKEND_ENV=development
CORS_ALLOW_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://subnota.com
LOG_LEVEL=INFO
```

Supabase Edge Function `supabase/.env.local`:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
DAILY_BRIEFING_CRON_KEY=
```

## App Development

Install JS dependencies:

```sh
cd mobile
corepack pnpm install
```

Start Metro:

```sh
cd mobile
corepack pnpm start --reset-cache
```

Run iOS:

```sh
cd mobile
corepack pnpm ios
```

For real iPhone testing, set `MEMO_BACKEND_URL` to the Mac's LAN address:

```text
MEMO_BACKEND_URL=http://192.168.x.x:8000
```

## Desktop (Electron) Development

The macOS and Windows apps are separate Electron projects at the repo root. Both use **pnpm** and the same scripts:

```sh
cd macos          # or: cd windows
pnpm install
pnpm start                 # Electron Forge + Vite dev server (HMR)
pnpm test                  # Vitest
pnpm run lint              # ESLint
```

Packaging is platform-specific:

```sh
cd macos && pnpm run build:dmg       # macOS DMG
cd windows && pnpm run build:exe     # Windows Squirrel Setup EXE
```

Apply feature changes to both apps together — they share ~95% of their `src/`. See [`ELECTRON_MIGRATION_STATUS.md`](./ELECTRON_MIGRATION_STATUS.md) for migration status and remaining work.

## Backend Development

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```sh
curl http://localhost:8000/health
```

Run split maintenance jobs:

```sh
curl -X POST http://localhost:8000/maintenance/memo-chunks/index-dirty-users \
  -H "Content-Type: application/json" \
  -H "x-backend-admin-key: <BACKEND_ADMIN_KEY>" \
  -d '{}'

curl -X POST http://localhost:8000/maintenance/schedule-inbox/scan-dirty-users \
  -H "Content-Type: application/json" \
  -H "x-backend-admin-key: <BACKEND_ADMIN_KEY>" \
  -d '{}'

curl -X POST http://localhost:8000/maintenance/topic-discovery/run-dirty-users \
  -H "Content-Type: application/json" \
  -H "x-backend-admin-key: <BACKEND_ADMIN_KEY>" \
  -d '{}'
```

## Supabase

Current schema migrations:

```text
supabase/migrations/20260519_final_schema.sql
supabase/migrations/20260525_topic_memo_edges_patch.sql
supabase/migrations/20260528_inbox_sessions.sql
supabase/migrations/20260530_inbox_session_embeddings.sql
supabase/migrations/20260531_inbox_structured_summaries.sql
supabase/migrations/20260602_hnsw_vector_indexes.sql
supabase/migrations/20260611_inbox_client_id.sql
supabase/migrations/20260611_memo_category.sql
supabase/migrations/20260613_inbox_sessions_updated_order.sql
supabase/migrations/20260620_topic_memo_embedding_cache.sql
supabase/migrations/20260621_network_index_consistency.sql
supabase/migrations/20260622_desktop_reliability.sql
supabase/migrations/20260623000000_memo_chunk_edges.sql
supabase/migrations/20260623000100_db_security_and_edge_consistency.sql
supabase/migrations/20260623000200_rls_performance.sql
supabase/migrations/20260623000300_drop_ivfflat_indexes.sql
supabase/migrations/20260623104359_memo_content_anchor_and_cron.sql
supabase/migrations/20260623110725_topic_dirty_nonempty_only.sql
supabase/migrations/20260623194520_schedule_inbox_atomic_replace.sql
supabase/migrations/20260624000000_fk_indexes.sql
supabase/migrations/20260624000100_memo_tombstones_and_revision.sql
supabase/migrations/20260624000200_memo_conflict_copy_rpc.sql
supabase/migrations/20260625000000_calendar_completed_at.sql
supabase/migrations/20260626000000_growth_events.sql
supabase/migrations/20260626000100_trees.sql
```

The schema defines:

- `profiles`
- `memos`
- `calendar_blocks` (includes block completion states and timestamps)
- `schedule_inbox`
- `memo_chunks`
- `chunk_embedding_cache`
- `topic_memo_embedding_cache`
- `briefings`
- `topic_clusters`
- `topic_cluster_memos`
- `topic_memo_edges`
- `inbox_sessions`
- `activity_completions` (gamification completed items, append-only ledger)
- `daily_completions` (gamification watered days, one record per day)
- `trees` (gamification forest planted trees, frozen at plant time)
- inbox summary embeddings
- `match_memo_chunks` pgvector RPC with memo timestamp metadata
- HNSW vector indexes for memo and inbox embedding search
- inbox `client_id` idempotency and latest-first ordering indexes

Apply these migrations before using online sync, schedule inbox, inbox summaries, network search, or topic discovery.

## Verification

TypeScript:

```sh
cd mobile
corepack pnpm -s tsc --noEmit
```

Jest:

```sh
cd mobile
corepack pnpm -s jest --runInBand
```

Python syntax:

```sh
cd backend
.venv/bin/python -m compileall app
```

Backend route smoke check:

```sh
cd backend
.venv/bin/python - <<'PY'
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
print(client.get("/health").json())
PY
```

## Current Limitations

- Supabase sync is service-backed but not a full conflict-resolution system.
- Automatic schedule suggestions appear only after backend batch has run.
- Daily briefings are generated by the Supabase Edge Function and shown in the briefing archive.
- State B quality depends on indexed `memo_chunks`.
- State A topic clusters are produced by backend batch, while the app displays them through the memo network UI.
- PWA has been removed from the active app tree and is not part of the current RN/backend flow.
- macOS/Windows are mid-migration to Electron; the legacy RN macOS target has been removed from `mobile/macos/` (see [`ELECTRON_MIGRATION_STATUS.md`](./ELECTRON_MIGRATION_STATUS.md)).
