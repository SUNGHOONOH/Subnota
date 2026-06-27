-- Cache whole-memo embeddings used by topic discovery. Clustering still runs
-- over the complete vector set, but unchanged memo text is not re-embedded.

create table if not exists public.topic_memo_embedding_cache (
  user_id uuid references public.profiles(id) on delete cascade not null,
  memo_id uuid references public.memos(id) on delete cascade not null,
  content_hash text not null,
  embedding vector(1024) not null,
  embedding_model text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (memo_id, embedding_model)
);

create index if not exists topic_memo_embedding_cache_user_idx
  on public.topic_memo_embedding_cache (user_id, memo_id);

drop trigger if exists topic_memo_embedding_cache_set_updated_at
  on public.topic_memo_embedding_cache;

create trigger topic_memo_embedding_cache_set_updated_at
before update on public.topic_memo_embedding_cache
for each row execute function public.set_updated_at();

grant select on public.topic_memo_embedding_cache to authenticated;
grant all privileges on public.topic_memo_embedding_cache to service_role;

alter table public.topic_memo_embedding_cache enable row level security;

drop policy if exists "Users can view own topic memo embeddings"
  on public.topic_memo_embedding_cache;

create policy "Users can view own topic memo embeddings"
on public.topic_memo_embedding_cache for select
using (auth.uid() = user_id);
