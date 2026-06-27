-- Atomic replace for schedule_inbox suggestions.
--
-- Previously the batch ran: delete+upsert schedule_inbox, then a SEPARATE
-- mark_memo_schedule_scanned() that also overwrote memos.content_hash. If the
-- memo was edited during the scan window, that overwrite forced
-- schedule_scanned_hash = content_hash (marking never-scanned content "clean")
-- and corrupted content_hash, which also drives chunk-index dirty detection
-- (indexed_content_hash is distinct from content_hash).
--
-- This mirrors replace_memo_chunks_if_current: one transaction that proceeds
-- only while the memo's current content_hash still matches the scanned content,
-- replaces the pending rows, and marks the scan WITHOUT touching content_hash.
create or replace function public.replace_schedule_inbox_if_current(
  p_user_id uuid,
  p_memo_id uuid,
  p_content_hash text,
  p_expected_content text,
  p_items jsonb
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

  -- Backfill content_hash for memos written before it was computed, matching
  -- replace_memo_chunks_if_current.
  if current_content_hash is null and current_content = p_expected_content then
    update public.memos
    set content_hash = p_content_hash
    where id = p_memo_id;
    current_content_hash := p_content_hash;
  end if;

  -- Memo changed since it was read for scanning: leave it dirty for next run.
  if current_content_hash is distinct from p_content_hash then
    return false;
  end if;

  delete from public.schedule_inbox
  where user_id = p_user_id
    and memo_id = p_memo_id
    and status = 'pending';

  insert into public.schedule_inbox (
    user_id,
    memo_id,
    source_key,
    source_text_hash,
    source_text,
    source_start,
    source_end,
    title,
    scheduled_at,
    time_text,
    all_day,
    confidence
  )
  select
    p_user_id,
    p_memo_id,
    item->>'source_key',
    item->>'source_text_hash',
    item->>'source_text',
    (item->>'source_start')::int,
    (item->>'source_end')::int,
    item->>'title',
    (item->>'scheduled_at')::timestamptz,
    item->>'time_text',
    coalesce((item->>'all_day')::boolean, false),
    coalesce(item->>'confidence', 'candidate')
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
  on conflict (user_id, source_key) do update set
    memo_id = excluded.memo_id,
    source_text_hash = excluded.source_text_hash,
    source_text = excluded.source_text,
    source_start = excluded.source_start,
    source_end = excluded.source_end,
    title = excluded.title,
    scheduled_at = excluded.scheduled_at,
    time_text = excluded.time_text,
    all_day = excluded.all_day,
    confidence = excluded.confidence;

  update public.memos
  set schedule_scanned_hash = p_content_hash,
      schedule_scan_status = 'scanned',
      schedule_scanned_at = now()
  where id = p_memo_id
    and content_hash = p_content_hash;

  return true;
end;
$$;

revoke all on function public.replace_schedule_inbox_if_current(
  uuid, uuid, text, text, jsonb
) from public;
grant execute on function public.replace_schedule_inbox_if_current(
  uuid, uuid, text, text, jsonb
) to service_role;
