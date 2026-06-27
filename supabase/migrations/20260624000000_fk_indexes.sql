-- Add the foreign-key indexes that were missing on memo_id columns.
--
-- Without these, deleting a memo (or cascading a user delete) forces a
-- sequential scan of each child table to enforce the FK action
-- (ON DELETE CASCADE / SET NULL), which gets slow and lock-heavy as the tables
-- grow. See PostgreSQL docs on referential integrity and indexing FK columns.
--
-- Covered FKs (confirmed missing as of 2026-06-24):
--   calendar_blocks.memo_id        -> memos(id) ON DELETE SET NULL
--   schedule_inbox.memo_id         -> memos(id) ON DELETE CASCADE
--   topic_cluster_memos.memo_id    -> memos(id) ON DELETE CASCADE
--   topic_memo_edges.source_memo_id-> memos(id) ON DELETE CASCADE
--   topic_memo_edges.target_memo_id-> memos(id) ON DELETE CASCADE
--
-- These tables are small today, so a plain CREATE INDEX (brief ACCESS EXCLUSIVE
-- lock) is fine and keeps this inside the normal transactional migration flow.
-- For a large production table, build the same indexes with CREATE INDEX
-- CONCURRENTLY instead — that statement CANNOT run inside a transaction block,
-- so it must be applied OUTSIDE the migration runner (see ops script / report).
--
-- No RLS, grant, or data-compatibility impact: indexes only affect planning.
-- Idempotent: safe to re-run.

create index if not exists calendar_blocks_memo_id_idx
  on public.calendar_blocks (memo_id);

create index if not exists schedule_inbox_memo_id_idx
  on public.schedule_inbox (memo_id);

create index if not exists topic_cluster_memos_memo_id_idx
  on public.topic_cluster_memos (memo_id);

create index if not exists topic_memo_edges_source_memo_id_idx
  on public.topic_memo_edges (source_memo_id);

create index if not exists topic_memo_edges_target_memo_id_idx
  on public.topic_memo_edges (target_memo_id);
