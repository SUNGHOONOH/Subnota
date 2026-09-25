-- Remove schema left behind by retired features.
--
-- Verified 2026-09-25 against the released desktop (v1.0.4), the deployed
-- backend, the unreleased iOS app and every public function body: none read or
-- write these objects.
--   trees                            calendar tree gamification (abolished), 0 rows
--   find_dirty_memo_user_ids(2 args) superseded by the 3-arg (row scan limit) version
--   memos.last_indexed_at            retired server memo-chunk index
--   memos.last_synced_at             never read or written
--   profiles.briefing_time           retired daily briefing
--   profiles.push_token              never read or written
begin;

drop table if exists public.trees;

drop function if exists public.find_dirty_memo_user_ids(text, integer);

alter table public.memos
  drop column if exists last_indexed_at,
  drop column if exists last_synced_at;

alter table public.profiles
  drop column if exists briefing_time,
  drop column if exists push_token;

commit;
