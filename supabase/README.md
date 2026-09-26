# Subnota Supabase

`migrations/` contains the versioned schema changes. The production migration
history and its mapping to local migration filenames are documented in
[`db.md`](db.md). Production was checked read-only on 2026-09-27: it has 39
recorded migrations through `20260925020000` and the cleanup migrations from
2026-09-25 are already applied.

## Current schema

The current public schema has 18 tables, all with RLS enabled:

- Identity and user data: `profiles`, `memos`, `calendar_blocks`,
  `schedule_inbox`
- Topics and memo relationships: `topic_clusters`, `topic_cluster_memos`,
  `topic_memo_embedding_cache`, `memo_similarity_edges`
- Saved links and topic links: `inbox_sessions`, `inbox_session_embeddings`,
  `topic_cluster_inbox_items`, `topic_memo_inbox_edges`
- Completion history: `activity_completions`, `daily_completions`
- Folder organization: `memo_folders`, `memo_folder_memberships`,
  `memo_folder_exclusions`
- Backend-only sync ledger: `memo_tombstones`

`topic_memo_edges` and `trees` are retired. `memo_folders` no longer has the
`description` or `classifier_terms` columns; automatic classification uses
on-device models in the desktop app.

## Seed and reset safety

**Never run `supabase/seed/seed.sql` in the Supabase SQL Editor or against a
linked/production database.** It is an old test fixture with unscoped `DELETE`
statements and references tables/columns removed from the current schema. It can
erase real user data on a schema where those statements still apply.

The current `config.toml` enables seeding with `sql_paths = ["./seed.sql"]`,
which resolves to `supabase/seed.sql`; that file does not exist. The old fixture
is at `supabase/seed/seed.sql`, so the configured path and the tracked fixture
do not match. Do not fix this by pointing the config at the old fixture. There
is currently no safe, current-schema seed fixture.

For a disposable local database, use only the local stack and skip seed files:

```sh
supabase start
supabase db reset --local --no-seed
```

This reset deletes and recreates the **local** database. Do not add `--linked`:
`supabase db reset --linked` drops and rebuilds the remote database. If test data
is needed later, create a current-schema fixture that inserts/upserts only
dedicated test rows, then verify it against a disposable local database before
enabling it.

## Production migration safety

Production history includes manually recorded/generated versions that do not
always match the local migration filename. Do not use a blanket
`supabase db push` until the mapping in [`db.md`](db.md) is reconciled. For a
schema change, create and review a new migration, check the linked migration
history and live schema, then apply only the intended change. Never replay the
full migration directory in the SQL Editor.
