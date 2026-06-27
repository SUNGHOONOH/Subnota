-- Drop the redundant IVFFlat vector indexes; keep HNSW as the sole ANN index.
--
-- HNSW indexes (added in 20260602_hnsw_vector_indexes.sql) are the production
-- default for this semantic-search workload: better speed/recall tradeoff, no
-- training step, and resilient to ongoing writes. Maintaining a second ANN
-- index per column only adds write/storage cost with no query benefit here.
--
-- HNSW indexes retained:
--   memo_chunks_embedding_hnsw_idx
--   inbox_session_embeddings_embedding_hnsw_idx
--
-- Note: at larger scale, confirm the planner picks HNSW (EXPLAIN ANALYZE on
-- match_memo_chunks / match_inbox_session_embeddings) and tune ef_search if
-- recall needs it. Re-adding an index later is non-destructive.

drop index if exists public.memo_chunks_embedding_idx;
drop index if exists public.inbox_session_embeddings_embedding_idx;
