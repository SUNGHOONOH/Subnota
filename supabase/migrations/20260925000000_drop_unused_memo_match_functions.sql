-- Drop the two server-side "find similar memo / saved link" RPCs.
--
-- Nothing calls them: nearby notes and ambient search run on-device, and the
-- backend helpers that wrapped them were removed. Topics keeps its own
-- embeddings and rebuild_user_memo_similarity_edges, which are untouched.
--
-- match_inbox_session_embeddings was created in production without a local
-- migration, so resolve both signatures from the live catalog.
begin;

do $$
declare
  routine record;
begin
  for routine in
    select
      n.nspname as schema_name,
      p.proname as routine_name,
      pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'match_topic_memo_embeddings',
        'match_inbox_session_embeddings'
      )
  loop
    execute format(
      'drop function if exists %I.%I(%s)',
      routine.schema_name,
      routine.routine_name,
      routine.arguments
    );
  end loop;
end;
$$;

commit;
