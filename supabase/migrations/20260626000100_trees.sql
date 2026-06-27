-- Forest of planted trees. Only PLANTED (matured-and-kept) trees are stored;
-- the currently-growing tree is always derived (generation = count of planted
-- trees, stats = events since the last planting). So "exactly one growing tree"
-- holds by construction, and planting is a single idempotent INSERT — no
-- growing/forest status column, no partial unique index, no multi-step RPC.
--
-- final_params is frozen at plant time, so a forest tree's look never changes.
-- unique(user_id, generation) makes planting atomic + idempotent (a double
-- plant computes the same generation and the second insert is a no-op).
create table if not exists public.trees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  generation int not null,
  planted_at timestamptz not null default now(),
  final_params jsonb not null,
  completed_todo_count int not null default 0,
  completed_day_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, generation)
);

create index if not exists trees_user_idx on public.trees (user_id, generation);

alter table public.trees enable row level security;
grant select, insert on public.trees to authenticated;

create policy "trees_select_own" on public.trees
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "trees_insert_own" on public.trees
  for insert to authenticated with check ((select auth.uid()) = user_id);
