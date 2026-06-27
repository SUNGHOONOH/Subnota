-- Phase 2 of the sync-integrity work: stop lost updates on concurrent edits.
--
-- A blind upsert overwrites whatever is on the server, so a stale offline copy
-- can clobber a newer edit from another device. This RPC replaces the blind
-- upsert with an atomic optimistic-concurrency check keyed on content_hash (the
-- value clients already track as synced_content_hash):
--
--   * row absent            -> insert (status 'inserted')
--   * server unchanged base -> update  (status 'updated')
--   * server changed (base mismatch) -> CONFLICT: keep the server row as
--     canonical and preserve the client's losing content as a NEW memo
--     (the conflict copy), then return status 'conflict'
--   * id tombstoned         -> 'deleted' (Phase 1 delete-wins, no resurrection)
--
-- The conflict copy id is derived deterministically from (memo id + losing
-- content hash) and inserted ON CONFLICT DO NOTHING, so retries never create
-- duplicate copies (idempotent). No data is ever lost: both versions survive.
--
-- SECURITY DEFINER + auth.uid(): the function is called directly by the
-- authenticated client, so it derives the user from the JWT (never trusts a
-- client-supplied user id) and scopes every statement to that user. The Phase 1
-- tombstone triggers still fire as defense in depth.

alter table public.memos
  add column if not exists conflict_of uuid;

create or replace function public.upsert_memo_if_base_hash(
  p_id uuid,
  p_base_hash text,
  p_content text,
  p_content_hash text,
  p_category text,
  p_content_updated_at timestamptz,
  p_created_at timestamptz
)
returns table (status text, content text, content_hash text, conflict_copy_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_current public.memos;
  v_copy_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  -- Deleted elsewhere: do not resurrect (Phase 1 semantics).
  if exists (select 1 from public.memo_tombstones t where t.memo_id = p_id) then
    return query select 'deleted'::text, null::text, null::text, null::uuid;
    return;
  end if;

  select * into v_current
  from public.memos m
  where m.id = p_id and m.user_id = v_uid
  for update;

  if not found then
    insert into public.memos (
      id, user_id, content, content_hash, synced_content_hash,
      content_updated_at, category, sync_status, indexed_content_hash,
      schedule_scanned_hash, schedule_scan_status, topic_dirty, is_archived,
      created_at, updated_at
    )
    values (
      p_id, v_uid, p_content, p_content_hash, p_content_hash,
      coalesce(p_content_updated_at, now()), p_category, 'synced', null,
      null, 'pending', true, false,
      coalesce(p_created_at, now()), coalesce(p_content_updated_at, now())
    );
    return query select 'inserted'::text, p_content, p_content_hash, null::uuid;
    return;
  end if;

  -- Server unchanged since the client's base (or already equal): safe update.
  if v_current.content_hash is not distinct from p_base_hash
     or v_current.content_hash is not distinct from p_content_hash then
    update public.memos m
    set content = p_content,
        content_hash = p_content_hash,
        synced_content_hash = p_content_hash,
        content_updated_at = coalesce(p_content_updated_at, now()),
        category = p_category,
        sync_status = 'synced',
        indexed_content_hash = null,
        schedule_scanned_hash = null,
        schedule_scan_status = 'pending',
        topic_dirty = true,
        updated_at = coalesce(p_content_updated_at, now())
    where m.id = p_id and m.user_id = v_uid;
    return query select 'updated'::text, p_content, p_content_hash, null::uuid;
    return;
  end if;

  -- Conflict: keep the server row canonical, preserve the losing local content
  -- as an idempotent conflict copy.
  v_copy_id := md5(p_id::text || ':' || coalesce(p_content_hash, ''))::uuid;
  insert into public.memos (
    id, user_id, content, content_hash, synced_content_hash,
    content_updated_at, category, sync_status, indexed_content_hash,
    schedule_scanned_hash, schedule_scan_status, topic_dirty, is_archived,
    conflict_of, created_at, updated_at
  )
  values (
    v_copy_id, v_uid, p_content, p_content_hash, p_content_hash,
    coalesce(p_content_updated_at, now()), p_category, 'synced', null,
    null, 'pending', true, false,
    p_id, coalesce(p_created_at, now()), now()
  )
  on conflict (id) do nothing;

  return query select 'conflict'::text, v_current.content, v_current.content_hash, v_copy_id;
end;
$$;

revoke all on function public.upsert_memo_if_base_hash(
  uuid, text, text, text, text, timestamptz, timestamptz
) from public, anon;
grant execute on function public.upsert_memo_if_base_hash(
  uuid, text, text, text, text, timestamptz, timestamptz
) to authenticated, service_role;
