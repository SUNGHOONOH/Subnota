-- Security hardening and deterministic memo-chunk graph maintenance.
-- This migration is intentionally idempotent because the production project
-- predates Supabase migration history tracking.

-- 1) New functions must be private by default. Functions that form part of the
-- Data API receive an explicit grant below.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- 2) Backend-only vector search RPCs. These functions bypass RLS, so callers
-- must not be able to choose another user's id.
create or replace function public.match_memo_chunks(
  p_user_id uuid,
  p_query_embedding public.vector(1024),
  p_embedding_model text,
  p_match_count int default 5,
  p_exclude_memo_id uuid default null
)
returns table (
  memo_id uuid,
  chunk_id uuid,
  chunk_text text,
  start_index int,
  end_index int,
  similarity double precision,
  memo_content text,
  memo_created_at timestamptz,
  memo_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform set_config('hnsw.iterative_scan', 'strict_order', true);

  return query
  select
    mc.memo_id,
    mc.id,
    mc.chunk_text,
    mc.start_index,
    mc.end_index,
    1 - (mc.embedding operator(public.<=>) p_query_embedding),
    m.content,
    m.created_at,
    m.updated_at
  from public.memo_chunks as mc
  join public.memos as m on m.id = mc.memo_id
  where mc.user_id = p_user_id
    and m.user_id = p_user_id
    and mc.embedding_model = p_embedding_model
    and m.is_archived = false
    and (p_exclude_memo_id is null or mc.memo_id <> p_exclude_memo_id)
  order by mc.embedding operator(public.<=>) p_query_embedding
  limit greatest(p_match_count, 1);
end;
$$;

revoke all on function public.match_memo_chunks(
  uuid, public.vector, text, int, uuid
) from public, anon, authenticated;
grant execute on function public.match_memo_chunks(
  uuid, public.vector, text, int, uuid
) to service_role;

create or replace function public.match_inbox_session_embeddings(
  p_user_id uuid,
  p_query_embedding public.vector(1024),
  p_embedding_model text,
  p_match_count int default 5
)
returns table (
  inbox_session_id uuid,
  chunk_id uuid,
  chunk_text text,
  similarity double precision,
  source_type text,
  source_label text,
  title text,
  source_url text,
  thumbnail_url text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform set_config('hnsw.iterative_scan', 'strict_order', true);

  return query
  select
    ise.inbox_session_id,
    ise.id,
    ise.chunk_text,
    1 - (ise.embedding operator(public.<=>) p_query_embedding),
    ise.source_type,
    ise.source_label,
    ise.title,
    ise.source_url,
    ise.thumbnail_url,
    ise.created_at
  from public.inbox_session_embeddings as ise
  join public.inbox_sessions as ins on ins.id = ise.inbox_session_id
  where ise.user_id = p_user_id
    and ins.user_id = p_user_id
    and ise.embedding_model = p_embedding_model
    and ins.summary is not null
    and ins.summary_status in ('ready', 'partial')
  order by ise.embedding operator(public.<=>) p_query_embedding
  limit greatest(p_match_count, 1);
end;
$$;

revoke all on function public.match_inbox_session_embeddings(
  uuid, public.vector, text, int
) from public, anon, authenticated;
grant execute on function public.match_inbox_session_embeddings(
  uuid, public.vector, text, int
) to service_role;

-- 3) Inbox ingestion is backend-only. RLS remains enabled as defense in depth.
drop policy if exists "Users can view own inbox sessions"
  on public.inbox_sessions;
drop policy if exists "Users can insert own inbox sessions"
  on public.inbox_sessions;
drop policy if exists "Users can update own inbox sessions"
  on public.inbox_sessions;
drop policy if exists "Users can delete own inbox sessions"
  on public.inbox_sessions;
drop policy if exists "Users can view own inbox embeddings"
  on public.inbox_session_embeddings;

revoke all privileges on public.inbox_sessions from anon, authenticated;
revoke all privileges on public.inbox_session_embeddings from anon, authenticated;
grant all privileges on public.inbox_sessions to service_role;
grant all privileges on public.inbox_session_embeddings to service_role;

-- 4) Rebuild the complete graph for one user and model in one transaction.
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
    user_id,
    source_chunk_id,
    target_chunk_id,
    source_memo_id,
    target_memo_id,
    similarity,
    embedding_model
  )
  select
    p_user_id,
    src.id,
    nbr.id,
    src.memo_id,
    nbr.memo_id,
    nbr.similarity,
    p_embedding_model
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

-- Compatibility for a backend revision that still calls the old per-memo RPC.
-- It is correct but may rebuild more than once until that backend is replaced.
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
    e.target_chunk_id,
    mc.memo_id,
    mc.chunk_text,
    mc.start_index,
    mc.end_index,
    e.similarity,
    m.content,
    m.created_at,
    m.updated_at
  from public.memo_chunk_edges as e
  join public.memo_chunks as mc
    on mc.id = e.target_chunk_id
   and mc.user_id = p_user_id
  join public.memos as m
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

-- 5) Short-lived leases prevent duplicate Cloud Run work without holding a
-- database transaction open while the embedding model runs.
create table if not exists public.memo_chunk_index_leases (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lease_token uuid not null,
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.memo_chunk_index_leases enable row level security;
revoke all privileges on public.memo_chunk_index_leases
  from anon, authenticated, service_role;

create or replace function public.claim_memo_chunk_index_lease(
  p_user_id uuid,
  p_lease_token uuid,
  p_lease_seconds int default 900
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_acquired boolean;
begin
  insert into public.memo_chunk_index_leases (
    user_id,
    lease_token,
    lease_expires_at
  )
  values (
    p_user_id,
    p_lease_token,
    clock_timestamp() + make_interval(
      secs => least(greatest(p_lease_seconds, 30), 3600)
    )
  )
  on conflict (user_id) do update
  set lease_token = excluded.lease_token,
      lease_expires_at = excluded.lease_expires_at
  where public.memo_chunk_index_leases.lease_expires_at <= clock_timestamp()
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

create or replace function public.release_memo_chunk_index_lease(
  p_user_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.memo_chunk_index_leases
  where user_id = p_user_id
    and lease_token = p_lease_token;
  return found;
end;
$$;

revoke all on function public.claim_memo_chunk_index_lease(
  uuid, uuid, int
) from public, anon, authenticated;
revoke all on function public.release_memo_chunk_index_lease(
  uuid, uuid
) from public, anon, authenticated;
grant execute on function public.claim_memo_chunk_index_lease(
  uuid, uuid, int
) to service_role;
grant execute on function public.release_memo_chunk_index_lease(
  uuid, uuid
) to service_role;

-- 6) Trigger helpers are not Data API endpoints. Pin their lookup path and
-- remove direct execution from application roles.
alter function public.handle_new_user() set search_path = '';
alter function public.set_updated_at() set search_path = '';
revoke all on function public.handle_new_user()
  from public, anon, authenticated;
revoke all on function public.set_updated_at()
  from public, anon, authenticated;

-- Keep the production-only RLS event trigger in the reproducible schema.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
       and cmd.schema_name = 'public' then
      begin
        execute format(
          'alter table if exists %s enable row level security',
          cmd.object_identity
        );
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %',
          cmd.object_identity;
      end;
    end if;
  end loop;
end;
$$;

revoke all on function public.rls_auto_enable()
  from public, anon, authenticated;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
execute function public.rls_auto_enable();
