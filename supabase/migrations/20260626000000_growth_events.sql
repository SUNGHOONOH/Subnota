-- Permanent growth-event ledger for the tree feature.
--
-- Philosophy: growth never regresses. Uncompleting or DELETING a calendar block
-- must NOT remove a recorded event — so there is intentionally no FK from
-- calendar_block_id to calendar_blocks. Both tables are append-only and made
-- idempotent by a unique key (insert ... on conflict do nothing).

-- First-ever completion of a calendar block. One row per block, ever.
create table if not exists public.activity_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  calendar_block_id uuid not null,
  completed_at timestamptz not null,
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, calendar_block_id)
);

create index if not exists activity_completions_user_date_idx
  on public.activity_completions (user_id, local_date);

-- A fully-completed day (>=1 block, all done) = one "watering". One per day.
create table if not exists public.daily_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  completed_at timestamptz not null,
  todo_count int not null,
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create index if not exists daily_completions_user_date_idx
  on public.daily_completions (user_id, local_date);

-- Owner-only access, mirroring calendar_blocks' optimized (select auth.uid())
-- form. Append-only from the client, so only select + insert are exposed.
alter table public.activity_completions enable row level security;
alter table public.daily_completions enable row level security;
grant select, insert on public.activity_completions to authenticated;
grant select, insert on public.daily_completions to authenticated;

create policy "activity_completions_select_own" on public.activity_completions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "activity_completions_insert_own" on public.activity_completions
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "daily_completions_select_own" on public.daily_completions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_completions_insert_own" on public.daily_completions
  for insert to authenticated with check ((select auth.uid()) = user_id);
