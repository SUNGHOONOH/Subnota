-- Adds State A detail memo-to-memo edges for already-created Supabase projects.

create table if not exists public.topic_memo_edges (
  topic_id uuid references public.topic_clusters(id) on delete cascade not null,
  source_memo_id uuid references public.memos(id) on delete cascade not null,
  target_memo_id uuid references public.memos(id) on delete cascade not null,
  similarity double precision not null,
  created_at timestamptz default now(),
  primary key (topic_id, source_memo_id, target_memo_id),
  check (source_memo_id <> target_memo_id)
);

grant select on public.topic_memo_edges to authenticated;
grant all privileges on public.topic_memo_edges to service_role;

alter table public.topic_memo_edges enable row level security;

drop policy if exists "Users can view own topic memo edges"
on public.topic_memo_edges;

create policy "Users can view own topic memo edges"
on public.topic_memo_edges for select
using (
  exists (
    select 1
    from public.topic_clusters
    where topic_clusters.id = topic_memo_edges.topic_id
      and topic_clusters.user_id = auth.uid()
  )
);
