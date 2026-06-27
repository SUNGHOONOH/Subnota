-- Network request protection, bounded query cache, and atomic memo chunk indexing.

create table if not exists public.network_rate_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count int not null default 0 check (request_count >= 0)
);

alter table public.network_rate_limits enable row level security;
revoke all on public.network_rate_limits from anon, authenticated;

create or replace function public.consume_network_rate_limit(
  p_user_id uuid,
  p_request_limit int,
  p_window_seconds int default 60
)
returns table (allowed boolean, retry_after_seconds int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count int;
  current_window timestamptz;
  current_time timestamptz := clock_timestamp();
begin
  if p_request_limit < 1 or p_window_seconds < 1 then
    raise exception 'Rate limit values must be positive';
  end if;

  insert into public.network_rate_limits (user_id, window_started_at, request_count)
  values (p_user_id, current_time, 0)
  on conflict (user_id) do nothing;

  select request_count, window_started_at
    into current_count, current_window
  from public.network_rate_limits
  where user_id = p_user_id
  for update;

  if current_window + make_interval(secs => p_window_seconds) <= current_time then
    update public.network_rate_limits
    set window_started_at = current_time, request_count = 1
    where user_id = p_user_id;
    return query select true, 0;
    return;
  end if;

  if current_count >= p_request_limit then
    return query
      select false, greatest(
        1,
        ceil(extract(epoch from (
          current_window + make_interval(secs => p_window_seconds) - current_time
        )))::int
      );
    return;
  end if;

  update public.network_rate_limits
  set request_count = request_count + 1
  where user_id = p_user_id;
  return query select true, 0;
end;
$$;

revoke all on function public.consume_network_rate_limit(uuid, int, int) from public;
grant execute on function public.consume_network_rate_limit(uuid, int, int) to service_role;

create or replace function public.prune_chunk_embedding_cache(
  p_max_age_days int default 60,
  p_max_rows_per_user int default 500
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count int;
begin
  with ranked as (
    select
      user_id,
      chunk_hash,
      row_number() over (
        partition by user_id
        order by updated_at desc, chunk_hash
      ) as row_number
    from public.chunk_embedding_cache
  ), deleted as (
    delete from public.chunk_embedding_cache cache
    using ranked
    where cache.user_id = ranked.user_id
      and cache.chunk_hash = ranked.chunk_hash
      and (
        cache.updated_at < now() - make_interval(days => greatest(p_max_age_days, 1))
        or ranked.row_number > greatest(p_max_rows_per_user, 1)
      )
    returning 1
  )
  select count(*)::int into deleted_count from deleted;

  return coalesce(deleted_count, 0);
end;
$$;

revoke all on function public.prune_chunk_embedding_cache(int, int) from public;
grant execute on function public.prune_chunk_embedding_cache(int, int) to service_role;

create or replace function public.replace_memo_chunks_if_current(
  p_user_id uuid,
  p_memo_id uuid,
  p_content_hash text,
  p_expected_content text,
  p_embedding_model text,
  p_chunks jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_content text;
  current_content_hash text;
begin
  select content, content_hash
    into current_content, current_content_hash
  from public.memos
  where id = p_memo_id
    and user_id = p_user_id
    and is_archived = false
  for update;

  if not found then
    return false;
  end if;

  if current_content_hash is null and current_content = p_expected_content then
    update public.memos
    set content_hash = p_content_hash
    where id = p_memo_id;
    current_content_hash := p_content_hash;
  end if;

  if current_content_hash is distinct from p_content_hash then
    return false;
  end if;

  delete from public.memo_chunks where memo_id = p_memo_id;

  insert into public.memo_chunks (
    user_id,
    memo_id,
    chunk_hash,
    chunk_index,
    chunk_text,
    start_index,
    end_index,
    sentence_indices,
    embedding,
    embedding_model,
    content_hash
  )
  select
    p_user_id,
    p_memo_id,
    item->>'chunk_hash',
    (item->>'chunk_index')::int,
    item->>'chunk_text',
    (item->>'start_index')::int,
    (item->>'end_index')::int,
    array(
      select value::int
      from jsonb_array_elements_text(coalesce(item->'sentence_indices', '[]'::jsonb)) value
    ),
    -- search_path='' means the vector type must use this project's actual
    -- pgvector installation schema.
    (item->>'embedding')::public.vector(1024),
    p_embedding_model,
    p_content_hash
  from jsonb_array_elements(coalesce(p_chunks, '[]'::jsonb)) item;

  update public.memos
  set indexed_content_hash = p_content_hash,
      last_indexed_at = now()
  where id = p_memo_id
    and content_hash = p_content_hash;

  return found;
end;
$$;

revoke all on function public.replace_memo_chunks_if_current(
  uuid, uuid, text, text, text, jsonb
) from public;
grant execute on function public.replace_memo_chunks_if_current(
  uuid, uuid, text, text, text, jsonb
) to service_role;

create or replace function public.find_dirty_memo_user_ids(
  p_kind text,
  p_user_limit int
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select memos.user_id
  from public.memos
  where memos.is_archived = false
    and case p_kind
      when 'chunks' then
        memos.content_hash is null
        or memos.indexed_content_hash is null
        or memos.content_hash <> memos.indexed_content_hash
      when 'schedule' then
        memos.content_hash is null
        or memos.schedule_scanned_hash is null
        or memos.content_hash <> memos.schedule_scanned_hash
      when 'topics' then memos.topic_dirty = true
      else false
    end
  group by memos.user_id
  order by min(memos.updated_at) asc
  limit greatest(p_user_limit, 1);
$$;

revoke all on function public.find_dirty_memo_user_ids(text, int) from public;
grant execute on function public.find_dirty_memo_user_ids(text, int) to service_role;

drop function if exists public.match_memo_chunks(uuid, vector, int, uuid);
drop function if exists public.match_memo_chunks(uuid, vector(1024), text, int, uuid);
create function public.match_memo_chunks(
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

drop function if exists public.match_inbox_session_embeddings(uuid, vector, int);
drop function if exists public.match_inbox_session_embeddings(uuid, vector(1024), text, int);
create function public.match_inbox_session_embeddings(
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
    and ise.embedding_model = p_embedding_model
    and ins.user_id = p_user_id
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
