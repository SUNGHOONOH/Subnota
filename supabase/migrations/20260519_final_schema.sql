-- MemoApp final schema
-- Last updated: 2026-05-20
--
-- Local-first rules:
-- - The app can create/edit notes locally without auth or network.
-- - Supabase sync is optional and starts only when the user wants device sync.
-- - Backend batch jobs read dirty rows with the service role key.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- 1. Profiles: optional sync identity and briefing settings.
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  display_name text,
  push_token text,
  briefing_time time default '22:00',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Memos: synced copy of local-first notes.
create table public.memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  content_hash text,
  synced_content_hash text,
  indexed_content_hash text,
  schedule_scanned_hash text,
  sync_status text default 'pending'
    check (sync_status in ('pending', 'synced', 'failed')),
  schedule_scan_status text default 'pending'
    check (schedule_scan_status in ('pending', 'scanned', 'failed')),
  topic_dirty boolean default true,
  is_archived boolean default false,
  last_synced_at timestamptz,
  last_indexed_at timestamptz,
  schedule_scanned_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index memos_user_updated_idx on public.memos (user_id, updated_at desc);
create index memos_schedule_scan_idx
  on public.memos (user_id, schedule_scan_status, updated_at desc)
  where is_archived = false;
create index memos_topic_dirty_idx
  on public.memos (user_id, topic_dirty)
  where is_archived = false and topic_dirty = true;

-- 3. Calendar blocks: scheduled items extracted from memos or created manually.
create table public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  memo_id uuid references public.memos(id) on delete set null,
  title text not null,
  note text,
  start_date timestamptz not null,
  end_date timestamptz,
  all_day boolean default false,
  "order" int default 0,
  color text default '#007AFF',
  is_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index calendar_blocks_user_start_idx
  on public.calendar_blocks (user_id, start_date);

-- 4. Schedule inbox: nightly backend suggestions shown in the Briefing tab.
create table public.schedule_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  memo_id uuid references public.memos(id) on delete cascade not null,
  source_key text not null,
  source_text_hash text not null,
  source_text text not null,
  source_start int,
  source_end int,
  title text not null,
  scheduled_at timestamptz not null,
  time_text text,
  all_day boolean default false,
  confidence text default 'candidate'
    check (confidence in ('auto', 'candidate')),
  status text default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, source_key)
);

create index schedule_inbox_user_status_idx
  on public.schedule_inbox (user_id, status, scheduled_at);

-- 5. Memo chunks: sentence/network units for State B similarity search.
create table public.memo_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  memo_id uuid references public.memos(id) on delete cascade not null,
  chunk_hash text not null,
  chunk_index int not null,
  chunk_text text not null,
  start_index int not null,
  end_index int not null,
  sentence_indices int[] default '{}',
  embedding vector(1024) not null,
  embedding_model text not null,
  content_hash text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (memo_id, chunk_hash)
);

create index memo_chunks_user_memo_idx on public.memo_chunks (user_id, memo_id);
create index memo_chunks_embedding_idx
  on public.memo_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 6. Lightweight query embedding cache for State B button searches.
create table public.chunk_embedding_cache (
  user_id uuid references public.profiles(id) on delete cascade not null,
  chunk_hash text not null,
  chunk_text text not null,
  embedding vector(1024) not null,
  embedding_model text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, chunk_hash)
);

-- 6. Briefings: daily/weekly LLM briefing history.
create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  type text not null check (type in ('daily', 'weekly')),
  briefing_date date default current_date,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  unique (user_id, type, briefing_date)
);

-- 7. Topic clusters: State A unconscious map nodes.
create table public.topic_clusters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  label text not null,
  keywords text[] default '{}',
  representative_memo_ids uuid[] default '{}',
  memo_count int default 0,
  confidence double precision,
  model_version text,
  input_hash text,
  source text default 'server',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. Topic cluster memberships: memo-to-topic links for State A.
create table public.topic_cluster_memos (
  topic_id uuid references public.topic_clusters(id) on delete cascade not null,
  memo_id uuid references public.memos(id) on delete cascade not null,
  score double precision,
  created_at timestamptz default now(),
  primary key (topic_id, memo_id)
);

-- Timestamp helper.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger memos_set_updated_at
before update on public.memos
for each row execute function public.set_updated_at();

create trigger calendar_blocks_set_updated_at
before update on public.calendar_blocks
for each row execute function public.set_updated_at();

create trigger schedule_inbox_set_updated_at
before update on public.schedule_inbox
for each row execute function public.set_updated_at();

create trigger memo_chunks_set_updated_at
before update on public.memo_chunks
for each row execute function public.set_updated_at();

create trigger chunk_embedding_cache_set_updated_at
before update on public.chunk_embedding_cache
for each row execute function public.set_updated_at();

create trigger topic_clusters_set_updated_at
before update on public.topic_clusters
for each row execute function public.set_updated_at();

-- Profile bootstrap for optional auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- State B pgvector search. Backend can call this with the service role key.
create or replace function public.match_memo_chunks(
  p_user_id uuid,
  p_query_embedding vector(1024),
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
language sql
stable
as $$
  select
    memo_chunks.memo_id,
    memo_chunks.id as chunk_id,
    memo_chunks.chunk_text,
    memo_chunks.start_index,
    memo_chunks.end_index,
    1 - (memo_chunks.embedding <=> p_query_embedding) as similarity,
    memos.content as memo_content,
    memos.created_at as memo_created_at,
    memos.updated_at as memo_updated_at
  from public.memo_chunks
  join public.memos on memos.id = memo_chunks.memo_id
  where memo_chunks.user_id = p_user_id
    and memos.is_archived = false
    and (p_exclude_memo_id is null or memo_chunks.memo_id <> p_exclude_memo_id)
  order by memo_chunks.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.memos enable row level security;
alter table public.calendar_blocks enable row level security;
alter table public.schedule_inbox enable row level security;
alter table public.memo_chunks enable row level security;
alter table public.chunk_embedding_cache enable row level security;
alter table public.briefings enable row level security;
alter table public.topic_clusters enable row level security;
alter table public.topic_cluster_memos enable row level security;

-- Profiles.
create policy "Users can view own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Memos.
create policy "Users can view own memos"
on public.memos for select
using (auth.uid() = user_id);

create policy "Users can insert own memos"
on public.memos for insert
with check (auth.uid() = user_id);

create policy "Users can update own memos"
on public.memos for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own memos"
on public.memos for delete
using (auth.uid() = user_id);

-- Calendar blocks.
create policy "Users can view own blocks"
on public.calendar_blocks for select
using (auth.uid() = user_id);

create policy "Users can insert own blocks"
on public.calendar_blocks for insert
with check (auth.uid() = user_id);

create policy "Users can update own blocks"
on public.calendar_blocks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own blocks"
on public.calendar_blocks for delete
using (auth.uid() = user_id);

-- Schedule inbox.
create policy "Users can view own schedule inbox"
on public.schedule_inbox for select
using (auth.uid() = user_id);

create policy "Users can update own schedule inbox"
on public.schedule_inbox for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Memo chunks are readable only by their owner. Writes are backend/service-role.
create policy "Users can view own memo chunks"
on public.memo_chunks for select
using (auth.uid() = user_id);

-- Briefings.
create policy "Users can view own briefings"
on public.briefings for select
using (auth.uid() = user_id);

-- Topic discovery.
create policy "Users can view own topic clusters"
on public.topic_clusters for select
using (auth.uid() = user_id);

create policy "Users can view own topic cluster memos"
on public.topic_cluster_memos for select
using (
  exists (
    select 1
    from public.topic_clusters
    where topic_clusters.id = topic_cluster_memos.topic_id
      and topic_clusters.user_id = auth.uid()
  )
);
