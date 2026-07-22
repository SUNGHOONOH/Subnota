# Subnota database handoff

Last verified: 2026-07-15 (Asia/Seoul)

This document describes the production Supabase database after the security and
memo graph consistency migration. It is intended as the starting point for any
agent changing database code.

## Product and access model

Subnota is login-first and local-first. A user must authenticate before their
local data is synchronized. Desktop/mobile clients access user-owned memo,
calendar, topic, briefing, chunk and graph-read data through Supabase RLS.
Backend-only ingestion, embedding, maintenance and replacement operations go
through FastAPI on Cloud Run with the Supabase `service_role`.

- Supabase project: `memo_plan`
- Project ref: `kwrbbxctutngcoqtccjv`
- PostgreSQL: 17
- pgvector: installed in the **`public` schema**, not `extensions`
- Backend service: `subnota-backend`, region `us-central1`
- Edge Function: `daily-briefing`, JWT verification enabled, not scheduled

Never copy service-role, cron or backend-admin secrets into source, SQL,
documentation or chat. Production secrets are stored in Supabase secrets or
Google Secret Manager.

## Source of truth and migration workflow

The production schema was verified from the live catalog on 2026-07-15. The
canonical production migration history is the 30-row
`supabase_migrations.schema_migrations` table, whose latest recorded version is
`20260707190355_topic_memo_inbox_edges`.

The local SQL files are the reproducible source for future work, but their
filenames do not exactly match every production history version. Several SQL
files were executed manually and later recorded with generated timestamps, and
the inbox-topic feature was recorded in production as two migrations before the
final edge migration:

| Local file | Production history entry | Status |
| --- | --- | --- |
| `20260624000000_fk_indexes.sql` | `20260626054754_fk_indexes` | reflected in production |
| `20260624000100_memo_tombstones_and_revision.sql` | `20260626054819_memo_tombstones_and_revision` | reflected in production |
| `20260624000200_memo_conflict_copy_rpc.sql` | `20260626054838_memo_conflict_copy_rpc` | reflected in production |
| `20260625000000_calendar_completed_at.sql` | `20260626054851_calendar_completed_at` | reflected in production |
| `20260626000000_growth_events.sql` | `20260626055812_growth_events` | reflected in production |
| `20260626000100_trees.sql` | `20260626062143_trees` | reflected in production |
| `20260708000000_topic_cluster_inbox_items.sql` | `20260707181903_topic_cluster_inbox_items` + `20260707182219_topic_cluster_inbox_items_service_grant` | reflected in production |

The production history is intentionally not duplicated with the local
filenames. Do not mark these local aliases as new applied migrations and do not
run a blanket `supabase db push`; that would re-run changes already reflected
in production. For a future migration, first reconcile the local filename and
production version mapping, then apply only genuinely new SQL.

For future changes:

```bash
supabase migration new <descriptive_name>
# edit the generated SQL
supabase db push --linked
supabase migration list --linked
```

Do not paste migration files into the SQL Editor and do not edit production
without also committing the equivalent migration. Existing migrations are the
reproducible chain; new production changes belong in a new migration.

The project CLI configuration is `supabase/config.toml`.

## Public tables (23)

All public tables have RLS enabled.

### User-facing, owner-scoped

- `profiles`: profile, briefing preference and push metadata.
- `memos`: canonical synchronized memo rows, user content timestamp and indexing state hashes.
- `calendar_blocks`: calendar entries linked to memos where applicable.
- `schedule_inbox`: backend-generated schedule suggestions; owner read/update.
- `briefings`: generated daily/weekly briefing history; currently daily only.
- `memo_chunks`: BGE-M3 chunk embeddings; owner read.
- `memo_chunk_edges`: persisted approximate directed top-K chunk graph; owner read.
- `topic_clusters`: State A topic clusters.
- `topic_cluster_memos`: topic membership rows.
- `topic_memo_edges`: memo relationships inside topics.
- `topic_memo_embedding_cache`: whole-memo embeddings used by topic discovery.
- `memo_similarity_edges`: persisted memo-level similarity graph.
- `topic_cluster_inbox_items`: inbox sessions attached to a topic cluster.
- `topic_memo_inbox_edges`: memo-to-inbox links inside a topic cluster.
- `activity_completions`: append-only first-completion ledger.
- `daily_completions`: append-only fully-completed-day ledger.
- `trees`: immutable growth-tree snapshots by user and generation.

### Backend-only, no client policy

- `chunk_embedding_cache`: reusable chunk embedding cache.
- `network_rate_limits`: backend network-search rate-limit state.
- `inbox_sessions`: collected inbox content and summaries.
- `inbox_session_embeddings`: inbox chunk embeddings.
- `memo_chunk_index_leases`: short-lived per-user maintenance leases.
- `memo_tombstones`: backend-only delete-wins ledger for memo sync.

Backend-only tables intentionally have RLS enabled with zero policies and no
`anon`/`authenticated` privileges. The Supabase advisor reports this as INFO;
it is the intended deny-by-default design.

## Privileged functions

The following functions are backend-only. `anon` and `authenticated` must not
have `EXECUTE`; `service_role` must have it. Privileged functions pin their
`search_path`.

- `match_memo_chunks`
- `match_inbox_session_embeddings`
- `consume_network_rate_limit`
- `prune_chunk_embedding_cache`
- `replace_memo_chunks_if_current`
- `find_dirty_memo_user_ids`
- `fetch_dirty_memos`
- `replace_topic_map`
- `rebuild_user_memo_chunk_edges`
- `rebuild_user_memo_similarity_edges`
- `fetch_memo_chunk_neighbors`
- `claim_memo_chunk_index_lease`
- `release_memo_chunk_index_lease`
- `replace_schedule_inbox_if_current`
- `purge_old_memo_tombstones`

`rebuild_memo_chunk_edges` is a temporary service-only compatibility wrapper
for an older backend signature. The deployed backend calls
`rebuild_user_memo_chunk_edges`; remove the wrapper in a later migration after
the old revision is no longer needed.

Because pgvector is in `public`, functions with `search_path = ''` must use:

```sql
public.vector(1024)
operator(public.<=>)
```

Do not change these to `extensions.vector`; that previously broke indexing.

Project migrations create functions as `postgres`. Default function privileges
for that role are deny-by-default. Every intended RPC needs an explicit grant.
The Supabase-managed `supabase_admin` default ACL cannot be changed by the
project migration role, so project functions must continue to be created only
through the migration workflow and explicitly hardened.

## Triggers

- `auth.users` AFTER INSERT -> `public.handle_new_user()`.
- Public-table `set_updated_at` triggers exist on `calendar_blocks`,
  `chunk_embedding_cache`, `inbox_session_embeddings`, `memo_chunks`, `memos`,
  `profiles`, `schedule_inbox`, `topic_clusters`, and
  `topic_memo_embedding_cache`.
- `memos` also has revision and tombstone triggers:
  `memos_bump_revision`, `memos_record_tombstone`,
  `memos_guard_tombstone_update`, and `memos_block_tombstoned_insert`.
- Event trigger `ensure_rls` calls `public.rls_auto_enable()` after public table
  creation and enables RLS automatically.

`handle_new_user`, `set_updated_at` and `rls_auto_enable` are trigger helpers,
not public RPC endpoints. Their direct application-role execution is revoked.

## Memo chunk indexing and graph consistency

Embedding model: `dragonkue/BGE-m3-ko` (1024 dimensions).

Current workflow:

1. FastAPI claims `memo_chunk_index_leases` for the user.
2. All dirty memos are chunked and atomically replaced with
   `replace_memo_chunks_if_current`.
3. After the memo loop, FastAPI calls `rebuild_user_memo_chunk_edges` once.
4. The rebuild takes a transaction advisory lock for the user, deletes that
   user's/model's old edges and recreates the complete graph atomically.
5. The application lease is released. A crashed worker is recoverable after
   the lease expires.

Graph semantics are a persisted approximate **directed** top-K snapshot:

- K: 6
- minimum cosine similarity: 0.35
- HNSW iterative scan: `strict_order`
- source and target memos must be active and belong to the same user

It is not mutual KNN and is not automatically undirected. Consumers that need
an undirected graph must define that separately rather than assuming symmetry.

Production verification on 2026-07-15:

- active memo chunks: 74
- memo chunk edges: 392
- eligible active chunks without outgoing edges: 1; that chunk has zero eligible
  candidate neighbors at the configured similarity threshold, so this is not a
  rebuild omission
- cross-user edge mismatches: 0
- invalid embedding dimensions: 0

The old state had 7 eligible chunks without outgoing edges. That ordering bug
is fixed. Do not reintroduce per-memo delete-both-directions/reinsert-outgoing
logic.

## Schedule parsing anchor and maintenance cron

Relative schedule expressions such as `오늘`, `내일`, and `다음 주` are anchored
to the user's memo content input time, not the cron execution time.

- Column: `memos.content_updated_at`
- Client writes: macOS/Windows set `content_updated_at` whenever memo content is
  saved to Supabase.
- Existing data backfill: `content_updated_at = coalesce(created_at, updated_at, now())`
- Backend parser fallback order: `content_updated_at` -> `created_at` -> current
  time only if legacy data is malformed.

Do not use `memos.updated_at` as the parsing anchor. Maintenance writes such as
`schedule_scanned_hash`, `indexed_content_hash`, and topic/index state updates
touch `updated_at` through the trigger and would shift relative dates.

Current Cloud Scheduler jobs in `us-central1`:

| Job | Schedule | Time zone | Endpoint |
| --- | --- | --- | --- |
| `subnota-memo-chunks-index-dirty` | `5 */6 * * *` | Asia/Seoul | `/maintenance/memo-chunks/index-dirty-users` |
| `subnota-schedule-inbox-scan-dirty` | `20 3 * * *` | Asia/Seoul | `/maintenance/schedule-inbox/scan-dirty-users` |
| `subnota-topic-discovery-dirty` | `50 3 * * *` | Asia/Seoul | `/maintenance/topic-discovery/run-dirty-users` |

All three endpoints are dirty-only. They first call `find_dirty_memo_user_ids`
and return zero work when no dirty users exist. `row_scan_limit` is wired through
the backend and bounded in SQL. Topic dirty selection excludes blank memos,
because topic discovery intentionally ignores empty content.

`daily-briefing` is intentionally not scheduled.

## Security state after 2026-07-15

- `match_memo_chunks` and `match_inbox_session_embeddings` are service-only,
  have empty `search_path`, and include ownership predicates.
- Inbox tables and inbox embeddings are backend-only.
- `daily-briefing` fails closed when its cron key is absent or wrong, but no
  production cron currently calls it.
- `daily-briefing` no longer reads or logs `push_token`.
- The previously exposed backend admin key was rotated; old Secret Manager
  versions 1 and 2 are disabled; version 3 is enabled. Retrieve the current key
  from Secret Manager only when an authorized maintenance call is required.
- Production migration history contains 30 applied versions through
  `20260707190355_topic_memo_inbox_edges`.
- The live schema reflects all current local feature migrations, but several
  local filenames are aliases of production's generated migration versions;
  see the mapping table above.
- Supabase security advisor still reports the three tombstone trigger helpers as
  publicly executable SECURITY DEFINER functions. They are trigger-only helpers
  and not intended RPC endpoints, but their EXECUTE privileges should be
  explicitly revoked in a future hardening migration.

## Known deferred work

These are not current correctness blockers. Measure or confirm product behavior
before changing them.

Applied and pushed to production 2026-06-23:

- RLS owner policies rewritten to `(select auth.uid())` + `TO authenticated`
  (`20260623000200_rls_performance.sql`). Access semantics unchanged. Verified:
  performance advisor reports `auth_rls_initplan` = 0 and no new security issues.
- Redundant IVFFlat vector indexes dropped; HNSW retained
  (`20260623000300_drop_ivfflat_indexes.sql`). Verified: no `duplicate_index`
  advisor finding. Confirm HNSW query plans with `EXPLAIN ANALYZE` once data
  reaches representative scale.

Advisor exceptions intentionally left as-is (2026-07-15): `unindexed_foreign_keys`
(deferred FK work, INFO), `unused_index` (small dataset, INFO), `rls_enabled_no_policy`
(backend-only deny-by-default, INFO), `auth_leaked_password_protection` (deferred, WARN),
`extension_in_public` (pgvector move deferred, WARN).

Still deferred:

- Add missing FK indexes identified by the Supabase performance advisor,
  prioritizing real delete/join paths. Revisit as tables grow.
- Add explicit `TO authenticated` to the `topic_cluster_inbox_items` read policy.
- Add ownership validation or composite user-scoped constraints to topic join
  tables before multiple backend writers are introduced.
- Add a per-user advisory lock around `replace_topic_map` if topic discovery can
  overlap across cron, manual, or retry paths.
- Decide whether `briefings.briefing_date` should be `NOT NULL` and backfill
  before adding the constraint.
- Serialize `replace_topic_map` per user if concurrent topic jobs become real.
- Remove `memos.synced_content_hash` only after first removing its writes from
  every client (still written by iOS/macOS/Windows on each memo upsert), then
  dropping the column (expand-contract). Remove the `weekly` briefing enum value
  only after product/client confirmation. (synced_content_hash to be revisited
  after the IVFFlat removal lands.)
- pgvector remains in `public`. Moving the extension is a separate migration
  with broad dependency impact and is not a quick advisor cleanup.
- Supabase Auth leaked-password protection is currently disabled and should be
  enabled in the dashboard when the plan supports it.

After any DDL change, run both Supabase security and performance advisors and
record intentional exceptions here.
