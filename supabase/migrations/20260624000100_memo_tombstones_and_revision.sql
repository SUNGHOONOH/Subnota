-- Phase 1 of the sync-integrity work: stop deleted memos from resurrecting, and
-- lay the server-managed `revision` foundation for the later edit-conflict
-- (conflict-copy) phase.
--
-- No client changes are required for the resurrection fix — it is enforced
-- entirely by triggers, so BOTH delete paths are covered:
--   * mobile hard DELETE  (memoSyncService)         -> BEFORE DELETE tombstone
--   * desktop is_archived=true soft delete (data.ts) -> BEFORE UPDATE tombstone
--
-- A memo is "deleted" when it is hard-deleted OR archived. Either records a
-- sticky tombstone; once tombstoned, the id can neither be re-inserted nor
-- un-archived by a normal sync upsert, so a stale offline copy on another device
-- can no longer bring it back. memo ids are random UUIDs and never reused, so a
-- retention job can safely purge old tombstones.
--
-- Idempotent. RLS preserved (owner policies unchanged). memo_tombstones is
-- backend-only (no client grants); triggers are SECURITY DEFINER so the
-- authenticated delete/upsert paths maintain it without direct table access.

-- 1) Tombstone ledger (backend-only). user_id is indexed so the profile-delete
--    cascade does not seq-scan.
create table if not exists public.memo_tombstones (
  memo_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  deleted_at timestamptz not null default now()
);

create index if not exists memo_tombstones_user_idx
  on public.memo_tombstones (user_id, deleted_at);

alter table public.memo_tombstones enable row level security;
revoke all privileges on public.memo_tombstones from anon, authenticated;
grant all privileges on public.memo_tombstones to service_role;

-- 2) Server-managed revision (foundation for the deferred conflict-copy phase).
--    Bumps only on real content changes so backend metadata writes do not
--    inflate it. Existing rows are backfilled by the default.
alter table public.memos
  add column if not exists revision bigint not null default 1;

create or replace function public.bump_memo_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content is distinct from old.content then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists memos_bump_revision on public.memos;
create trigger memos_bump_revision
before update on public.memos
for each row execute function public.bump_memo_revision();

-- 3) Record a tombstone on hard delete.
create or replace function public.record_memo_tombstone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.memo_tombstones (memo_id, user_id, deleted_at)
  values (old.id, old.user_id, now())
  on conflict (memo_id) do update set deleted_at = now();
  return old;
end;
$$;

drop trigger if exists memos_record_tombstone on public.memos;
create trigger memos_record_tombstone
before delete on public.memos
for each row execute function public.record_memo_tombstone();

-- 4) Record a tombstone on archive (desktop soft delete) and make deletion
--    sticky: a tombstoned memo cannot be un-archived by a normal upsert.
create or replace function public.guard_memo_tombstone_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_archived is true and old.is_archived is distinct from true then
    insert into public.memo_tombstones (memo_id, user_id, deleted_at)
    values (new.id, new.user_id, now())
    on conflict (memo_id) do update set deleted_at = now();
  elsif new.is_archived is not true
    and exists (select 1 from public.memo_tombstones t where t.memo_id = new.id) then
    -- Resurrection attempt (un-archive of a deleted memo): keep it deleted.
    new.is_archived := true;
  end if;
  return new;
end;
$$;

drop trigger if exists memos_guard_tombstone_update on public.memos;
create trigger memos_guard_tombstone_update
before update on public.memos
for each row execute function public.guard_memo_tombstone_update();

-- 5) Block re-inserting a tombstoned id (mobile hard-delete + blind re-upsert).
--    Returning NULL silently discards the insert so the client's sync upsert is
--    a no-op success instead of erroring and retrying forever.
create or replace function public.block_tombstoned_memo_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.memo_tombstones t where t.memo_id = new.id) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists memos_block_tombstoned_insert on public.memos;
create trigger memos_block_tombstoned_insert
before insert on public.memos
for each row execute function public.block_tombstoned_memo_insert();

-- 6) Retention: purge tombstones past the grace window. Call from Cloud
--    Scheduler (or pg_cron if enabled).
create or replace function public.purge_old_memo_tombstones(p_max_age_days int default 90)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count int;
begin
  delete from public.memo_tombstones
  where deleted_at < now() - make_interval(days => greatest(p_max_age_days, 1));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_old_memo_tombstones(int) from public, anon, authenticated;
grant execute on function public.purge_old_memo_tombstones(int) to service_role;
