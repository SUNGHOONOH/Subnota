-- Allows offline web clipper retries to be idempotent after reconnect.

alter table public.inbox_sessions
  add column if not exists client_id text;

create unique index if not exists inbox_sessions_user_client_id_idx
  on public.inbox_sessions (user_id, client_id)
  where client_id is not null;
