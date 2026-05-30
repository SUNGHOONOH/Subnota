-- Shared link inbox for iOS Share Extension, macOS quick capture, and Chrome extension.

create table if not exists public.inbox_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  source_type text not null
    check (source_type in ('youtube', 'instagram', 'url', 'image')),
  original_url text,
  canonical_url text,
  domain text,
  title text,
  description text,
  thumbnail_url text,
  raw_shared_text text,
  selected_text text,
  user_note text,
  summary text,
  summary_one_liner text,
  summary_search_text text,
  summary_detail text,
  summary_status text not null default 'pending'
    check (summary_status in ('pending', 'ready', 'partial', 'unsupported', 'failed')),
  summary_basis text,
  summary_provider text,
  metadata jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists inbox_sessions_user_created_idx
  on public.inbox_sessions (user_id, created_at desc);

create index if not exists inbox_sessions_user_source_idx
  on public.inbox_sessions (user_id, source_type, created_at desc);

drop trigger if exists inbox_sessions_set_updated_at on public.inbox_sessions;
create trigger inbox_sessions_set_updated_at
before update on public.inbox_sessions
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.inbox_sessions to authenticated;
grant all privileges on public.inbox_sessions to service_role;

alter table public.inbox_sessions enable row level security;

drop policy if exists "Users can view own inbox sessions" on public.inbox_sessions;
create policy "Users can view own inbox sessions"
on public.inbox_sessions for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own inbox sessions" on public.inbox_sessions;
create policy "Users can insert own inbox sessions"
on public.inbox_sessions for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own inbox sessions" on public.inbox_sessions;
create policy "Users can update own inbox sessions"
on public.inbox_sessions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own inbox sessions" on public.inbox_sessions;
create policy "Users can delete own inbox sessions"
on public.inbox_sessions for delete
using (auth.uid() = user_id);
