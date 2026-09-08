-- Retire the server-side daily briefing and memo-chunk graph.
--
-- Nearby/ambient search now indexes memo chunks locally on each client.
-- Topics keeps its separate topic_memo_embedding_cache, and saved-link topic
-- attachments keep using inbox_session_embeddings. The legacy server network
-- search endpoint and its query-vector cache are no longer part of production.
begin;

do $$
declare
  routine record;
begin
  -- Signatures changed during the old memo-chunk implementation. Resolve the
  -- identity arguments from the live catalog instead of guessing signatures.
  for routine in
    select
      n.nspname as schema_name,
      p.proname as routine_name,
      pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'match_memo_chunks',
        'prune_chunk_embedding_cache',
        'consume_network_rate_limit',
        'replace_memo_chunks_if_current',
        'rebuild_memo_chunk_edges',
        'rebuild_user_memo_chunk_edges',
        'fetch_memo_chunk_neighbors',
        'claim_memo_chunk_index_lease',
        'release_memo_chunk_index_lease'
      )
  loop
    execute format(
      'drop function if exists %I.%I(%s) cascade',
      routine.schema_name,
      routine.routine_name,
      routine.arguments
    );
  end loop;
end;
$$;

drop table if exists public.memo_chunk_edges cascade;
drop table if exists public.memo_chunks cascade;
drop table if exists public.memo_chunk_index_leases cascade;
drop table if exists public.briefings cascade;
drop table if exists public.chunk_embedding_cache cascade;
drop table if exists public.network_rate_limits cascade;

commit;
