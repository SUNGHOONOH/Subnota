-- Add HNSW indexes for semantic search tables.
-- Keep existing IVFFlat indexes for now; remove them only after checking query plans.

create index if not exists memo_chunks_embedding_hnsw_idx
  on public.memo_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists inbox_session_embeddings_embedding_hnsw_idx
  on public.inbox_session_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
