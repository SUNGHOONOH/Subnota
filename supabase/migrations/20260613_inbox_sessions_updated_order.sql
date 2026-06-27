create index if not exists inbox_sessions_user_updated_idx
  on public.inbox_sessions (user_id, updated_at desc);
