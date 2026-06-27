-- Empty memos should not keep topic discovery cron dirty forever. The topic
-- discovery pipeline intentionally ignores blank memos, so dirty user selection
-- must do the same.

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
        when 'topics' then
          memos.topic_dirty = true
          and btrim(memos.content) <> ''
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
