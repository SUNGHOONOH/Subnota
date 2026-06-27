-- RLS performance hardening (no change to access semantics).
--
-- Two Supabase-recommended optimizations applied to every owner-scoped policy:
--   1. Wrap auth.uid() as (select auth.uid()) so the planner evaluates it once
--      as an initplan and caches it, instead of re-calling per row.
--   2. Scope each policy `to authenticated` so it is never evaluated for the
--      anon role. (Table privileges are already granted to authenticated /
--      service_role only, and service_role bypasses RLS, so effective access is
--      unchanged — this is purely an evaluation-cost optimization.)
--
-- Backend-only tables (inbox_sessions, inbox_session_embeddings, chunk_embedding_cache,
-- network_rate_limits, memo_chunk_index_leases) intentionally have no client
-- policy and are not touched here.

-- Profiles (keyed by id).
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Memos.
drop policy if exists "Users can view own memos" on public.memos;
create policy "Users can view own memos"
on public.memos for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own memos" on public.memos;
create policy "Users can insert own memos"
on public.memos for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own memos" on public.memos;
create policy "Users can update own memos"
on public.memos for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own memos" on public.memos;
create policy "Users can delete own memos"
on public.memos for delete to authenticated
using ((select auth.uid()) = user_id);

-- Calendar blocks.
drop policy if exists "Users can view own blocks" on public.calendar_blocks;
create policy "Users can view own blocks"
on public.calendar_blocks for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own blocks" on public.calendar_blocks;
create policy "Users can insert own blocks"
on public.calendar_blocks for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own blocks" on public.calendar_blocks;
create policy "Users can update own blocks"
on public.calendar_blocks for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own blocks" on public.calendar_blocks;
create policy "Users can delete own blocks"
on public.calendar_blocks for delete to authenticated
using ((select auth.uid()) = user_id);

-- Schedule inbox.
drop policy if exists "Users can view own schedule inbox" on public.schedule_inbox;
create policy "Users can view own schedule inbox"
on public.schedule_inbox for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can update own schedule inbox" on public.schedule_inbox;
create policy "Users can update own schedule inbox"
on public.schedule_inbox for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Memo chunks (owner read-only; writes are backend/service-role).
drop policy if exists "Users can view own memo chunks" on public.memo_chunks;
create policy "Users can view own memo chunks"
on public.memo_chunks for select to authenticated
using ((select auth.uid()) = user_id);

-- Briefings.
drop policy if exists "Users can view own briefings" on public.briefings;
create policy "Users can view own briefings"
on public.briefings for select to authenticated
using ((select auth.uid()) = user_id);

-- Topic clusters.
drop policy if exists "Users can view own topic clusters" on public.topic_clusters;
create policy "Users can view own topic clusters"
on public.topic_clusters for select to authenticated
using ((select auth.uid()) = user_id);

-- Topic cluster memos (ownership via parent topic_clusters).
drop policy if exists "Users can view own topic cluster memos" on public.topic_cluster_memos;
create policy "Users can view own topic cluster memos"
on public.topic_cluster_memos for select to authenticated
using (
  exists (
    select 1
    from public.topic_clusters
    where topic_clusters.id = topic_cluster_memos.topic_id
      and topic_clusters.user_id = (select auth.uid())
  )
);

-- Topic memo edges (ownership via parent topic_clusters).
drop policy if exists "Users can view own topic memo edges" on public.topic_memo_edges;
create policy "Users can view own topic memo edges"
on public.topic_memo_edges for select to authenticated
using (
  exists (
    select 1
    from public.topic_clusters
    where topic_clusters.id = topic_memo_edges.topic_id
      and topic_clusters.user_id = (select auth.uid())
  )
);

-- Topic memo embedding cache (owner read-only).
drop policy if exists "Users can view own topic memo embeddings" on public.topic_memo_embedding_cache;
create policy "Users can view own topic memo embeddings"
on public.topic_memo_embedding_cache for select to authenticated
using ((select auth.uid()) = user_id);

-- Memo chunk edges (owner read-only; writes are backend/service-role).
drop policy if exists "Users can view own memo chunk edges" on public.memo_chunk_edges;
create policy "Users can view own memo chunk edges"
on public.memo_chunk_edges for select to authenticated
using ((select auth.uid()) = user_id);
