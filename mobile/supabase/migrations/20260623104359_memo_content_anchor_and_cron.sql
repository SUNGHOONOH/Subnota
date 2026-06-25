-- Store the user-input timestamp that relative date parsing should anchor to.
-- `updated_at` is not suitable because backend maintenance writes also touch it.

alter table public.memos
  add column if not exists content_updated_at timestamptz;

update public.memos
set content_updated_at = coalesce(content_updated_at, created_at, updated_at, now())
where content_updated_at is null;

create index if not exists memos_user_content_updated_idx
  on public.memos (user_id, content_updated_at desc);

drop function if exists public.fetch_dirty_memos(uuid, text, int);

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
  updated_at timestamptz,
  content_updated_at timestamptz
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
    memos.updated_at,
    memos.content_updated_at
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

create or replace function public.find_dirty_memo_user_ids(
  p_kind text,
  p_user_limit int,
  p_row_scan_limit int default 5000
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with dirty_rows as (
    select memos.user_id, memos.updated_at
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
    order by memos.updated_at asc, memos.id
    limit least(greatest(p_row_scan_limit, 1), 50000)
  )
  select dirty_rows.user_id
  from dirty_rows
  group by dirty_rows.user_id
  order by min(dirty_rows.updated_at) asc
  limit greatest(p_user_limit, 1);
$$;

revoke all on function public.find_dirty_memo_user_ids(text, int, int) from public;
grant execute on function public.find_dirty_memo_user_ids(text, int, int) to service_role;

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
  select result.user_id
  from public.find_dirty_memo_user_ids(p_kind, p_user_limit, 5000) as result;
$$;

revoke all on function public.find_dirty_memo_user_ids(text, int) from public;
grant execute on function public.find_dirty_memo_user_ids(text, int) to service_role;
