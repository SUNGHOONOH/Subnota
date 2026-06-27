-- Desktop reliability: bounded dirty scans and timezone-safe all-day dates.

alter table public.calendar_blocks
  add column if not exists all_day_date date,
  add column if not exists time_zone text;

-- Existing desktop builds stored all-day selections as an instant. Preserve the
-- calendar day users saw in the product's original KST-only behavior.
update public.calendar_blocks
set all_day_date = (start_date at time zone 'Asia/Seoul')::date
where all_day = true
  and all_day_date is null;

create index if not exists memos_chunk_dirty_idx
  on public.memos (user_id, updated_at, id)
  where is_archived = false
    and (content_hash is null or indexed_content_hash is distinct from content_hash);

create index if not exists memos_schedule_dirty_idx
  on public.memos (user_id, updated_at, id)
  where is_archived = false
    and (content_hash is null or schedule_scanned_hash is distinct from content_hash);

create index if not exists calendar_blocks_user_all_day_idx
  on public.calendar_blocks (user_id, all_day_date)
  where all_day = true;

create or replace function public.fetch_dirty_memos(
  p_user_id uuid,
  p_kind text,
  p_limit int default 50
)
returns table (
  id uuid,
  content text,
  content_hash text,
  indexed_content_hash text,
  schedule_scanned_hash text,
  topic_dirty boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_kind not in ('chunks', 'schedule') then
    raise exception 'Unsupported dirty memo kind: %', p_kind;
  end if;

  return query
  select
    memos.id,
    memos.content,
    memos.content_hash,
    memos.indexed_content_hash,
    memos.schedule_scanned_hash,
    memos.topic_dirty,
    memos.created_at,
    memos.updated_at
  from public.memos
  where memos.user_id = p_user_id
    and memos.is_archived = false
    and case p_kind
      when 'chunks' then
        memos.content_hash is null
        or memos.indexed_content_hash is distinct from memos.content_hash
      when 'schedule' then
        memos.content_hash is null
        or memos.schedule_scanned_hash is distinct from memos.content_hash
      else false
    end
  order by memos.updated_at asc, memos.id
  limit least(greatest(p_limit, 1), 200);
end;
$$;

revoke all on function public.fetch_dirty_memos(uuid, text, int) from public;
grant execute on function public.fetch_dirty_memos(uuid, text, int) to service_role;

create or replace function public.replace_topic_map(
  p_user_id uuid,
  p_clusters jsonb,
  p_memberships jsonb,
  p_edges jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.topic_clusters where user_id = p_user_id;

  insert into public.topic_clusters (
    id, user_id, label, keywords, representative_memo_ids, memo_count,
    confidence, model_version, input_hash, source
  )
  select
    (item->>'id')::uuid,
    p_user_id,
    item->>'label',
    array(select jsonb_array_elements_text(coalesce(item->'keywords', '[]'::jsonb))),
    array(
      select value::uuid
      from jsonb_array_elements_text(
        coalesce(item->'representative_memo_ids', '[]'::jsonb)
      ) value
    ),
    coalesce((item->>'memo_count')::int, 0),
    (item->>'confidence')::double precision,
    item->>'model_version',
    item->>'input_hash',
    coalesce(item->>'source', 'server')
  from jsonb_array_elements(coalesce(p_clusters, '[]'::jsonb)) item;

  insert into public.topic_cluster_memos (topic_id, memo_id, score)
  select
    (item->>'topic_id')::uuid,
    (item->>'memo_id')::uuid,
    (item->>'score')::double precision
  from jsonb_array_elements(coalesce(p_memberships, '[]'::jsonb)) item;

  insert into public.topic_memo_edges (
    topic_id, source_memo_id, target_memo_id, similarity
  )
  select
    (item->>'topic_id')::uuid,
    (item->>'source_memo_id')::uuid,
    (item->>'target_memo_id')::uuid,
    (item->>'similarity')::double precision
  from jsonb_array_elements(coalesce(p_edges, '[]'::jsonb)) item;
end;
$$;

revoke all on function public.replace_topic_map(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.replace_topic_map(uuid, jsonb, jsonb, jsonb) to service_role;
