# Subnota database handoff

Database schema, migration history, and Supabase advisors last verified:
2026-09-27 (Asia/Seoul). Cloud Run, Cloud Scheduler, and Secret Manager details
below are operational snapshots last checked on 2026-09-25; they were not
re-queried during this documentation update.

This document describes the production Supabase database after the security and
memo graph consistency migration. It is intended as the starting point for any
agent changing database code.

## Product and access model

Subnota is login-first and local-first. A user must authenticate before their
local data is synchronized. Desktop clients and the in-progress native Swift
iOS app access user-owned memo, calendar, topic, schedule and graph-read data
through Supabase RLS. The legacy React Native client source has been removed
from this repository; that does not update or revoke already distributed
mobile builds. The native Swift app in `ios/` is still in development and is
not yet a release target.
Backend-only ingestion, embedding, maintenance and replacement operations go
through FastAPI on Cloud Run with the Supabase `service_role`.

- Supabase project: `memo_plan`
- Project ref: `kwrbbxctutngcoqtccjv`
- PostgreSQL: 17
- pgvector: installed in the **`public` schema**, not `extensions`
- Backend service: `subnota-backend`, region `us-central1`

Never copy service-role, cron or backend-admin secrets into source, SQL,
documentation or chat. Production secrets are stored in Supabase secrets or
Google Secret Manager.

## Source of truth and migration workflow

The production schema and migration history were checked read-only on
2026-09-27. The canonical production migration history contains 39 rows in
`supabase_migrations.schema_migrations`, through `20260925020000`.
`20260906075256_memo_folders` was applied by hand earlier; on
2026-09-25 its two missing `memo_id` indexes were created in production so the
schema matches the file, and the version was then recorded under the same name.

`supabase/migrations/` is listed in `.gitignore`; existing files were added
with `git add -f`, and new migration files need the same.

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
| `20260727125200_state_b_memo_search.sql` | `20260727130644_state_b_memo_search` | reflected in production |
| `20260708000000_topic_cluster_inbox_items.sql` | `20260707181903_topic_cluster_inbox_items` + `20260707182219_topic_cluster_inbox_items_service_grant` | reflected in production |
| `20260812113011_calendar_block_category_id.sql` | `20260812113112_calendar_block_category_id` | reflected in production |
| No local file (applied manually) | `20260815071841_profile_time_zone` | reflected in production |
| `20260824075337_revoke_tombstone_trigger_execute.sql` | `20260824075409_revoke_tombstone_trigger_execute` | reflected in production |
| `20260925000000_drop_unused_memo_match_functions.sql` | `20260925000000_drop_unused_memo_match_functions` | reflected in production |
| `20260925010000_drop_retired_trees_and_unused_columns.sql` | `20260925010000_drop_retired_trees_and_unused_columns` | reflected in production |
| `20260925020000_drop_topic_memo_edges_and_folder_text_columns.sql` | `20260925020000_drop_topic_memo_edges_and_folder_text_columns` | reflected in production |

The production history is intentionally not duplicated with the local
filenames. Do not mark these local aliases as new applied migrations and do not
run a blanket `supabase db push`; that would re-run changes already reflected
in production. For a future migration, first reconcile the local filename and
production version mapping, then apply only genuinely new SQL.

For future changes, first create the SQL with `supabase migration new`, then
reconcile its version with the production history before applying it. Until the
historical aliases are cleaned up, apply only the reviewed SQL file and record
the verified result; do not use an unscoped push.

```bash
supabase migration new <descriptive_name>
# edit and review the generated SQL
supabase db query --linked --file supabase/migrations/<timestamp>_<descriptive_name>.sql
supabase migration list --linked
```

Do not paste migration files into the SQL Editor and do not edit production
without also committing the equivalent migration. Existing migrations are the
reproducible chain; new production changes belong in a new migration.

The project CLI configuration is `supabase/config.toml`.

## Public tables (18)

All current public tables have RLS enabled. The retired tables `trees` and
`topic_memo_edges` are not present in production.

### User-facing, owner-scoped

- `profiles`: profile and an IANA
  `time_zone` for schedule extraction. It defaults to `Asia/Seoul` so existing
  users' schedule times do not shift before their desktop app reports a device
  time zone.
- `memos`: canonical synchronized memo rows, user content timestamp and indexing state hashes.
- `calendar_blocks`: calendar entries linked to memos where applicable, including an optional local-category reference.
- `schedule_inbox`: backend-generated schedule suggestions; owner read/update.
- `topic_clusters`: State A topic clusters.
- `topic_cluster_memos`: topic membership rows.
- `topic_memo_embedding_cache`: whole-memo embeddings used by topic discovery.
- `memo_similarity_edges`: persisted memo-level similarity graph.
- `topic_cluster_inbox_items`: inbox sessions attached to a topic cluster.
- `topic_memo_inbox_edges`: memo-to-inbox links inside a topic cluster.
- `activity_completions`: append-only first-completion ledger.
- `daily_completions`: append-only fully-completed-day ledger.
- `memo_folders`: user folders; `organization_mode` is `manual` or `automatic`.
  Automatic folders classify on-device with local embeddings. The table does
  not have `description` or `classifier_terms` columns.
- `memo_folder_memberships`: memo-in-folder rows; `assignment_source` is
  `user`, `topic_import` or `automatic`.
- `memo_folder_exclusions`: notes a user took out of an automatic folder, so
  they are never re-added automatically.

### Backend-only, no client policy

- `inbox_sessions`: collected inbox content and summaries.
- `inbox_session_embeddings`: inbox chunk embeddings.
- `memo_tombstones`: backend-only delete-wins ledger for memo sync.

Backend-only tables intentionally have RLS enabled with zero policies and no
`anon`/`authenticated` privileges. The Supabase advisor reports this as INFO;
it is the intended deny-by-default design.

## Privileged functions

The following functions are backend-only. `anon` and `authenticated` must not
have `EXECUTE`; `service_role` must have it. Privileged functions pin their
`search_path`.

- `find_dirty_memo_user_ids` (the current 3-argument version)
- `fetch_dirty_memos`
- `replace_topic_map`
- `rebuild_user_memo_similarity_edges`
- `replace_schedule_inbox_if_current`
- `purge_old_memo_tombstones`

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
  `inbox_session_embeddings`, `memos`,
  `profiles`, `schedule_inbox`, `topic_clusters`, and
  `topic_memo_embedding_cache`.
- `memos` also has revision and tombstone triggers:
  `memos_bump_revision`, `memos_record_tombstone`,
  `memos_guard_tombstone_update`, and `memos_block_tombstoned_insert`.
- Event trigger `ensure_rls` calls `public.rls_auto_enable()` after public table
  creation and enables RLS automatically.

`handle_new_user`, `set_updated_at` and `rls_auto_enable` are trigger helpers,
not public RPC endpoints. Their direct application-role execution is revoked.

## Applied cleanup migrations (2026-09-25)

The live migration history confirms all three local cleanup migrations are
applied through `20260925020000`:

- `20260925000000_drop_unused_memo_match_functions.sql` removed unused vector
  matching RPCs.
- `20260925010000_drop_retired_trees_and_unused_columns.sql` removed `trees`,
  the old two-argument `find_dirty_memo_user_ids`, and retired memo/profile
  columns.
- `20260925020000_drop_topic_memo_edges_and_folder_text_columns.sql` removed
  `topic_memo_edges` and the folder text columns. It preserves the
  `replace_topic_map` signature; its legacy `p_edges` argument is accepted but
  ignored.

The released v1.0.4 desktop client still requests the removed folder columns.
The planned v1.0.5 release must use the current schema-compatible desktop code.
Until older clients are updated, their local folder cache can remain visible,
but folder reads/writes to Supabase are not compatible with this schema.

## Local memo search retirement

Nearby and ambient memo search now splits and embeds memo chunks locally on
each desktop device. The server-side `memo_chunks`/`memo_chunk_edges` graph,
its indexing leases, and the daily briefing that consumed it are retired.
The retirement migration is
`20260908090000_retire_daily_briefing_and_server_memo_chunks.sql`.

The old `/network/search` endpoint, its query-vector cache, and its rate-limit
state are removed by the retirement migration. Topics and saved-link topic
attachments continue using their separate server embeddings.

The cleanup migration also removed `match_topic_memo_embeddings` and
`match_inbox_session_embeddings`; code and live-catalog checks found no callers.
Current advisor findings are recorded under “Known deferred work” below.

## Schedule parsing anchor and maintenance cron

Relative schedule expressions such as `오늘`, `내일`, and `다음 주` are anchored
to the user's memo content input time, not the cron execution time.

- Column: `memos.content_updated_at`
- Client writes: macOS/Windows set `content_updated_at` whenever memo content is
  saved to Supabase.
- Existing data backfill: `content_updated_at = coalesce(created_at, updated_at, now())`
- Backend parser fallback order: `content_updated_at` -> `created_at` -> current
  time only if legacy data is malformed.
- The parser converts that anchor into `profiles.time_zone` before resolving a
  relative expression. The Cloud Scheduler's `Asia/Seoul` execution setting
  controls only when the maintenance job runs; it does not choose a user's
  suggested schedule time.

Do not use `memos.updated_at` as the parsing anchor. Maintenance writes such as
`schedule_scanned_hash`, `indexed_content_hash`, and topic/index state updates
touch `updated_at` through the trigger and would shift relative dates.

Cloud Scheduler snapshot from 2026-09-25 (`us-central1`; recheck before changing
or relying on these jobs):

| Job | Schedule | Time zone | Endpoint |
| --- | --- | --- | --- |
| `subnota-schedule-inbox-scan-dirty` | `20 3 * * *` | Asia/Seoul | `/maintenance/schedule-inbox/scan-dirty-users` |
| `subnota-topic-discovery-dirty` | `50 3 * * *` | Asia/Seoul | `/maintenance/topic-discovery/run-dirty-users` |

Both active endpoints are dirty-only. They first call `find_dirty_memo_user_ids`
and return zero work when no dirty users exist. `row_scan_limit` is wired through
the backend and bounded in SQL. Topic dirty selection excludes blank memos,
because topic discovery intentionally ignores empty content.

`subnota-memo-chunks-index-dirty` was paused on 2026-09-08 and is no longer an
active maintenance job.

## Security and operations notes

- Inbox tables and inbox embeddings are backend-only.
- Historical Secret Manager note (not rechecked 2026-09-27): the previously
  exposed backend admin key was rotated; versions 1 and 2 were disabled and
  version 3 was enabled. Verify the live secret version before any maintenance.
- Production migration history contains the applied `profile_time_zone`
  migration at `20260815071841`.
- The live schema reflects all current local feature migrations, but several
  local filenames are aliases of production's generated migration versions;
  see the mapping table above.
- The three tombstone trigger helpers remain `SECURITY DEFINER`, but direct
  `EXECUTE` is revoked from `PUBLIC`, `anon`, and `authenticated` by production
  migration `20260824075409`. An authenticated insert/delete smoke test verified
  that the existing triggers still fire, and the transaction was rolled back.

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

Supabase advisors were checked on 2026-09-27. Findings intentionally left as-is:

- Security INFO: `rls_enabled_no_policy` on `inbox_sessions`,
  `inbox_session_embeddings`, and `memo_tombstones`. These are backend-only and
  intentionally deny client access.
- Security WARN: `extension_in_public` for pgvector; moving it requires a
  separate dependency-aware migration.
- Security WARN: `authenticated_security_definer_function_executable` for
  `upsert_memo_if_base_hash`. This authenticated client RPC is intentional; keep
  its ownership/base-hash checks intact and revisit before changing its grants.
- Security WARN: leaked-password protection is disabled in Supabase Auth.
- Performance INFO: five foreign keys lack covering indexes; nine indexes have
  not been used. With the current small dataset these are measurement/review
  candidates, not automatic deletion instructions.

Still deferred:

- Review the five currently reported unindexed foreign keys and add indexes only
  where query plans and delete/join paths justify them.
- Add explicit `TO authenticated` to the `topic_cluster_inbox_items` read policy.
- Add ownership validation or composite user-scoped constraints to topic join
  tables before multiple backend writers are introduced.
- Serialize `replace_topic_map` per user if topic discovery can overlap across
  cron, manual, or retry paths.
- Remove `memos.synced_content_hash` only after first removing its writes from
  every active client, then dropping the column (expand-contract). The native
  iOS app is still in development; confirm its writes before removing the field.
- pgvector remains in `public`. Moving the extension is a separate migration
  with broad dependency impact and is not a quick advisor cleanup.
- Supabase Auth leaked-password protection is currently disabled and should be
  enabled in the dashboard when the plan supports it.

After any DDL change, run both Supabase security and performance advisors and
record intentional exceptions here.
