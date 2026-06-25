-- Hybrid network search: precomputed chunk-to-chunk neighbour edges.
-- Mirrors topic_memo_edges but at chunk granularity, so the cursor's local
-- ego-graph can be read instantly when it sits on an already-indexed chunk.
-- Live KNN (match_memo_chunks) remains the fallback for unsaved/new text.

-- 1) Chunk -> chunk neighbour edges (precomputed local network).
create table if not exists public.memo_chunk_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  source_chunk_id uuid references public.memo_chunks(id) on delete cascade not null,
  target_chunk_id uuid references public.memo_chunks(id) on delete cascade not null,
  source_memo_id uuid references public.memos(id) on delete cascade not null,
  target_memo_id uuid references public.memos(id) on delete cascade not null,
  similarity double precision not null,
  embedding_model text not null,
  created_at timestamptz default now(),
  unique (source_chunk_id, target_chunk_id, embedding_model)
);

create index if not exists memo_chunk_edges_source_idx
  on public.memo_chunk_edges (user_id, source_chunk_id);
create index if not exists memo_chunk_edges_source_memo_idx
  on public.memo_chunk_edges (user_id, source_memo_id);
create index if not exists memo_chunk_edges_target_memo_idx
  on public.memo_chunk_edges (user_id, target_memo_id);

-- 2) Grants + RLS (writes are backend/service-role, reads are owner-only).
grant select on public.memo_chunk_edges to authenticated;
grant all privileges on public.memo_chunk_edges to service_role;

alter table public.memo_chunk_edges enable row level security;

drop policy if exists "Users can view own memo chunk edges"
  on public.memo_chunk_edges;
create policy "Users can view own memo chunk edges"
on public.memo_chunk_edges for select
using (auth.uid() = user_id);

-- 3) Rebuild one user's complete directed top-K snapshot atomically.
create or replace function public.rebuild_user_memo_chunk_edges(
  p_user_id uuid,
  p_embedding_model text,
  p_match_count int default 6,
  p_min_similarity double precision default 0.35
)
returns int
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  perform set_config('hnsw.iterative_scan', 'strict_order', true);

  delete from public.memo_chunk_edges as e
  where e.user_id = p_user_id
    and e.embedding_model = p_embedding_model;

  insert into public.memo_chunk_edges (
    user_id, source_chunk_id, target_chunk_id,
    source_memo_id, target_memo_id, similarity, embedding_model
  )
  select
    p_user_id, src.id, nbr.id, src.memo_id, nbr.memo_id,
    nbr.similarity, p_embedding_model
  from public.memo_chunks as src
  join public.memos as src_memo
    on src_memo.id = src.memo_id
   and src_memo.user_id = p_user_id
   and src_memo.is_archived = false
  cross join lateral (
    select
      candidate.id,
      candidate.memo_id,
      1 - (
        candidate.embedding operator(public.<=>) src.embedding
      ) as similarity
    from public.memo_chunks as candidate
    join public.memos as target_memo
      on target_memo.id = candidate.memo_id
     and target_memo.user_id = p_user_id
     and target_memo.is_archived = false
    where candidate.user_id = p_user_id
      and candidate.embedding_model = p_embedding_model
      and candidate.memo_id <> src.memo_id
    order by candidate.embedding operator(public.<=>) src.embedding
    limit greatest(p_match_count, 1)
  ) as nbr
  where src.user_id = p_user_id
    and src.embedding_model = p_embedding_model
    and nbr.similarity >= p_min_similarity;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.rebuild_user_memo_chunk_edges(
  uuid, text, int, double precision
) from public, anon, authenticated;
grant execute on function public.rebuild_user_memo_chunk_edges(
  uuid, text, int, double precision
) to service_role;

-- Compatibility wrapper for older backend revisions. It performs a correct
-- user-level rebuild even though the obsolete memo id remains in the API.
create or replace function public.rebuild_memo_chunk_edges(
  p_user_id uuid,
  p_memo_id uuid,
  p_embedding_model text,
  p_match_count int default 6,
  p_min_similarity double precision default 0.35
)
returns int
language sql
volatile
set search_path = ''
as $$
  select public.rebuild_user_memo_chunk_edges(
    p_user_id,
    p_embedding_model,
    p_match_count,
    p_min_similarity
  );
$$;

revoke all on function public.rebuild_memo_chunk_edges(
  uuid, uuid, text, int, double precision
) from public, anon, authenticated;
grant execute on function public.rebuild_memo_chunk_edges(
  uuid, uuid, text, int, double precision
) to service_role;

-- 4) Read precomputed neighbours of one chunk (the precompute search path).
create or replace function public.fetch_memo_chunk_neighbors(
  p_user_id uuid,
  p_chunk_id uuid,
  p_embedding_model text,
  p_match_count int default 6
)
returns table (
  chunk_id uuid,
  memo_id uuid,
  chunk_text text,
  start_index int,
  end_index int,
  similarity double precision,
  memo_content text,
  memo_created_at timestamptz,
  memo_updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    e.target_chunk_id, mc.memo_id, mc.chunk_text,
    mc.start_index, mc.end_index, e.similarity,
    m.content, m.created_at, m.updated_at
  from public.memo_chunk_edges e
  join public.memo_chunks mc
    on mc.id = e.target_chunk_id
   and mc.user_id = p_user_id
  join public.memos m
    on m.id = mc.memo_id
   and m.user_id = p_user_id
  where e.user_id = p_user_id
    and e.embedding_model = p_embedding_model
    and e.source_chunk_id = p_chunk_id
    and m.is_archived = false
  order by e.similarity desc
  limit greatest(p_match_count, 1);
$$;

revoke all on function public.fetch_memo_chunk_neighbors(
  uuid, uuid, text, int
) from public, anon, authenticated;
grant execute on function public.fetch_memo_chunk_neighbors(
  uuid, uuid, text, int
) to service_role;
