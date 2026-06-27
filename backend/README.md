# MemoApp Backend

Python backend for lightweight online enrichment: schedule inbox batch, State B
network search, memo chunk indexing, and State A topic discovery.

This backend is intentionally separate from the React Native app and Supabase Edge Functions.

## Responsibilities

- Run nightly schedule suggestion extraction from Supabase memos.
- Build Kiwi memo chunks and HF embeddings for State B search.
- Search similar memo chunks with Supabase pgvector (and map similarity to target memos).
- Run State A topic discovery from Supabase memos only when synced memos are marked dirty.
- Store clustering results into `topic_clusters`, `topic_cluster_memos`, and `topic_memo_edges`.
- Analyze inbox URLs (YouTube transcripts, metadata extraction, Playwright scraper fallbacks).
- Guard all incoming URL requests against SSRF (anti-SSRF routing protection).
- Provide unified daily maintenance endpoints for background jobs.

## Non-responsibilities

- It does not own memo editing or local data persistence.
- It does not run on every keystroke in the editor.
- It does not bypass Supabase Auth or client RLS policies.
- It does not expose service role tokens, Gemini API keys, or Hugging Face secrets to the clients.
- It does not store raw user memos locally on the backend.

## Structure

```text
backend/
  app/
    api/
      routes/                       # API endpoints and routers
        health.py                   # Health check endpoint
        inbox.py                    # Inbox clip management
        maintenance.py              # Scheduled batch triggers
        memo_chunks.py              # Chunk embedding indexing triggers
        network.py                  # State B network search
        schedule.py                 # Candidate schedule management
        topics.py                   # State A topic discovery
    core/
      config.py                     # Environment settings & config validation
      constants.py                  # Thresholds, timeouts, model variables
    db/                             # Service-role database access layer
      client.py                     # Supabase client instantiation
      embeddings.py                 # Vector queries and embedding caches
      inbox.py                      # Inbox database operations
      memos.py                      # Raw memo queries & filtering
      profiles.py                   # User profile management
      rate_limits.py                # Rate-limiting table checks
      schedule.py                   # Schedule updates
      topics.py                     # Topic clusters, memberships & edges
      types.py                      # DB model type defs
      utils.py                      # DB operation helpers
    features/                       # Core enrichment pipelines
      inbox/                        # Web clipping, scraping, summary (Gemini/Playwright)
      memo/                         # Sentence chunking (Kiwi) and embedding creation
      network/                      # Cursor chunk similarity search (pgvector)
      schedule/                     # Nightly schedule candidate extraction
      topics/                       # State A topic clustering pipeline
      maintenance/                  # Combined daily workflow coordinator
    shared/
      url_guard.py                  # Anti-SSRF URL validator
    main.py                         # FastAPI application entrypoint
  .env.example
  pyproject.toml
```

## Development

```bash
cd backend
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
uvicorn app.main:app --reload --port 8000
```

Required local values in `backend/.env`:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
HF_TOKEN=...
BACKEND_ADMIN_KEY=...
```

Do not commit `backend/.env`.

Development triggers (all maintenance and discovery routes require the admin key header):

```bash
curl -X POST http://localhost:8000/topic-discovery/run \
  -H "x-backend-admin-key: <BACKEND_ADMIN_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000","force":true}'

curl -X POST http://localhost:8000/maintenance/daily \
  -H "x-backend-admin-key: <BACKEND_ADMIN_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000"}'

curl -X POST http://localhost:8000/maintenance/daily-all \
  -H "x-backend-admin-key: <BACKEND_ADMIN_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Dirty-only endpoints used by scheduled Cloud Cron
curl -X POST http://localhost:8000/maintenance/memo-chunks/index-dirty-users \
  -H "x-backend-admin-key: <BACKEND_ADMIN_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Production Direction

Development:

```text
RN Network button -> FastAPI /network/search -> pgvector top 5
Daily cron -> FastAPI /maintenance/daily-all -> schedule_inbox + memo_chunks + topics
```

Production:

```text
Cron / queue -> same maintenance pipeline -> Supabase tables
```

The trigger changes, but the pipeline stays the same.

## Runtime policy

- Memo writing is local-first in the React Native app.
- Manual calendar registration works offline.
- Automatic schedule suggestions are online-only and generated by nightly batch.
- State B searches embed only the current cursor chunk at button-click time.
- State A topic discovery runs only when dirty memos exist.
- `/network/search` requires a Supabase user bearer token.
- Batch endpoints can be protected with `BACKEND_ADMIN_KEY`.

## State A clustering rule

Topic discovery thresholds live in `app/constants.py`, not `.env`.

- `TOPIC_MIN_MEMOS`: skip topic discovery below this count unless `force=true`.
- `TOPIC_HDBSCAN_MIN_MEMOS`: below this count, use Agglomerative clustering.
- `TOPIC_HDBSCAN_MIN_MEMOS` or above, use HDBSCAN.
- `TOPIC_HDBSCAN_MIN_CLUSTER_SIZE`: minimum size for a stable HDBSCAN topic.
- `TOPIC_DISTANCE_THRESHOLD`: Agglomerative split threshold for smaller memo sets.

Current embedding model:

```text
dragonkue/BGE-m3-ko
```

Embeddings are requested through Hugging Face Inference API. The backend does not download
the model locally; it only receives vectors and runs clustering locally.
