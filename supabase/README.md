# Subnota Supabase Database

This directory contains the database schema migrations, local seed data, and Edge Function configurations for Subnota.

## Database Migrations
These files are the local schema source and historical reference. Do not paste
the full list into the SQL Editor or replay it against production; check the
production history mapping below first.

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
supabase/migrations/20260627145059_memo_similarity_edges.sql
supabase/migrations/20260629000000_inbox_keywords_liked.sql
supabase/migrations/20260706000100_memo_conflict_merge_optin.sql
supabase/migrations/20260706020000_fix_network_rate_limit_timestamp.sql
supabase/migrations/20260707190355_topic_memo_inbox_edges.sql
supabase/migrations/20260708000000_topic_cluster_inbox_items.sql
```

## Production history

Production currently has 30 recorded migrations through
`20260707190355_topic_memo_inbox_edges`. The live schema reflects the feature
SQL represented by the local files, but several production entries use
generated timestamps because some SQL was executed manually before being
recorded in migration history. The inbox-topic membership change is recorded in
production as `20260707181903_topic_cluster_inbox_items` and
`20260707182219_topic_cluster_inbox_items_service_grant`; the local
`20260708000000_topic_cluster_inbox_items.sql` is the consolidated equivalent.

Do **not** run a blanket `supabase db push` until the local filenames and
production history mapping are deliberately reconciled. Re-applying a local
alias would duplicate an already reflected schema change.

## Schema Entities
The migrations define and configure the following database structures:
* `profiles` — User profile storage
* `memos` — User memos (local-first synced rows)
* `calendar_blocks` — Scheduled items, including completions and completion timestamps
* `schedule_inbox` — Daily schedule suggestion items
* `memo_chunks` & `chunk_embedding_cache` — Kiwi sentence splits and Hugging Face inference embeddings
* `topic_clusters`, `topic_cluster_memos`, & `topic_memo_edges` — Graph clusters and memo edge representations
* `inbox_sessions` & summary embeddings — Clipped URLs, YouTube transcripts, and metadata
* `activity_completions`, `daily_completions`, & `trees` — Gamification growth-event tracking ledger and planted forest configurations
