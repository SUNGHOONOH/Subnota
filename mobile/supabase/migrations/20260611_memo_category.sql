-- Keeps local memo categories, including Mini Subnota quick notes, in Supabase.

alter table public.memos
  add column if not exists category text not null default 'Ideas';

create index if not exists memos_user_category_updated_idx
  on public.memos (user_id, category, updated_at desc)
  where is_archived = false;
