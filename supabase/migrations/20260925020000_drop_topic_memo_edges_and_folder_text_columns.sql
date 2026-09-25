-- Second cleanup step. DO NOT APPLY until BOTH are true:
--   1. The backend without topic_memo_edges writes is deployed to Cloud Run.
--      (The v1.0.4-era backend deletes from and inserts into this table directly.)
--   2. No desktop older than the release after v1.0.4 is still in use.
--      (v1.0.4 selects and upserts memo_folders.description/classifier_terms by
--      name, so dropping them breaks folder sync on that version.)
--
-- topic_memo_edges: written on every topic run, read only by the legacy RN
-- app. The desktop Topics map uses memo_similarity_edges instead.
-- memo_folders.description / classifier_terms: automatic folders now classify
-- with local embeddings; neither column is shown or used.
begin;

-- Same signature so a backend still sending p_edges keeps working; the value
-- is ignored.
create or replace function public.replace_topic_map(
  p_user_id uuid,
  p_clusters jsonb,
  p_memberships jsonb,
  p_edges jsonb,
  p_inbox_items jsonb default '[]'::jsonb,
  p_inbox_edges jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  delete from public.topic_clusters where user_id = p_user_id;

  insert into public.topic_clusters (
    id, user_id, label, keywords, representative_memo_ids, memo_count,
    confidence, model_version, input_hash, source
  )
  select
    (item->>'id')::uuid,
    p_user_id,
    item->>'label',
    array(select jsonb_array_elements_text(coalesce(item->'keywords', '[]'::jsonb))),
    array(
      select value::uuid
      from jsonb_array_elements_text(
        coalesce(item->'representative_memo_ids', '[]'::jsonb)
      ) value
    ),
    coalesce((item->>'memo_count')::int, 0),
    (item->>'confidence')::double precision,
    item->>'model_version',
    item->>'input_hash',
    coalesce(item->>'source', 'server')
  from jsonb_array_elements(coalesce(p_clusters, '[]'::jsonb)) item;

  insert into public.topic_cluster_memos (topic_id, memo_id, score)
  select
    (item->>'topic_id')::uuid,
    (item->>'memo_id')::uuid,
    (item->>'score')::double precision
  from jsonb_array_elements(coalesce(p_memberships, '[]'::jsonb)) item;

  insert into public.topic_cluster_inbox_items (topic_id, inbox_session_id, score)
  select
    (item->>'topic_id')::uuid,
    (item->>'inbox_session_id')::uuid,
    (item->>'score')::double precision
  from jsonb_array_elements(coalesce(p_inbox_items, '[]'::jsonb)) item;

  insert into public.topic_memo_inbox_edges (
    topic_id, memo_id, inbox_session_id, similarity
  )
  select
    (item->>'topic_id')::uuid,
    (item->>'memo_id')::uuid,
    (item->>'inbox_session_id')::uuid,
    (item->>'similarity')::double precision
  from jsonb_array_elements(coalesce(p_inbox_edges, '[]'::jsonb)) item;
end;
$function$;

drop table if exists public.topic_memo_edges;

alter table public.memo_folders
  drop column if exists description,
  drop column if exists classifier_terms;

commit;
