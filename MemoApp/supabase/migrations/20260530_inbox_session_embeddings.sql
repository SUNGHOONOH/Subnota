-- Inbox summary embeddings for network recommendations.
-- Only user-saved inbox summaries are indexed.

create table if not exists public.inbox_session_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  inbox_session_id uuid references public.inbox_sessions(id) on delete cascade not null,
  source_type text not null
    check (source_type in ('youtube', 'instagram', 'url', 'image')),
  source_label text not null,
  title text,
  source_url text,
  thumbnail_url text,
  chunk_text text not null,
  summary_hash text not null,
  embedding vector(1024) not null,
  embedding_model text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (inbox_session_id, summary_hash, embedding_model)
);

create index if not exists inbox_session_embeddings_user_idx
  on public.inbox_session_embeddings (user_id, created_at desc);

create index if not exists inbox_session_embeddings_session_idx
  on public.inbox_session_embeddings (inbox_session_id);

create index if not exists inbox_session_embeddings_embedding_idx
  on public.inbox_session_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

drop trigger if exists inbox_session_embeddings_set_updated_at
  on public.inbox_session_embeddings;

create trigger inbox_session_embeddings_set_updated_at
before update on public.inbox_session_embeddings
for each row execute function public.set_updated_at();

grant select on public.inbox_session_embeddings to authenticated;
grant all privileges on public.inbox_session_embeddings to service_role;

alter table public.inbox_session_embeddings enable row level security;

drop policy if exists "Users can view own inbox embeddings"
  on public.inbox_session_embeddings;

create policy "Users can view own inbox embeddings"
on public.inbox_session_embeddings for select
using (auth.uid() = user_id);

create or replace function public.match_inbox_session_embeddings(
  p_user_id uuid,
  p_query_embedding vector(1024),
  p_match_count int default 5
)
returns table (
  inbox_session_id uuid,
  chunk_id uuid,
  chunk_text text,
  similarity double precision,
  source_type text,
  source_label text,
  title text,
  source_url text,
  thumbnail_url text,
  created_at timestamptz
)
language sql
stable
as $$
  select
    inbox_session_embeddings.inbox_session_id,
    inbox_session_embeddings.id as chunk_id,
    inbox_session_embeddings.chunk_text,
    1 - (inbox_session_embeddings.embedding <=> p_query_embedding) as similarity,
    inbox_session_embeddings.source_type,
    inbox_session_embeddings.source_label,
    inbox_session_embeddings.title,
    inbox_session_embeddings.source_url,
    inbox_session_embeddings.thumbnail_url,
    inbox_session_embeddings.created_at
  from public.inbox_session_embeddings
  join public.inbox_sessions
    on inbox_sessions.id = inbox_session_embeddings.inbox_session_id
  where inbox_session_embeddings.user_id = p_user_id
    and inbox_sessions.user_id = p_user_id
    and inbox_sessions.summary is not null
    and inbox_sessions.summary_status in ('ready', 'partial')
  order by inbox_session_embeddings.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;

grant execute on function public.match_inbox_session_embeddings(uuid, vector(1024), int)
  to authenticated, service_role;
