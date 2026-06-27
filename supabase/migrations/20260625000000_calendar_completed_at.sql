-- Calendar block completion timestamp.
-- is_completed already exists; completed_at records WHEN a block was completed
-- (null when not completed) so completion survives sync instead of being reset.
alter table public.calendar_blocks
  add column if not exists completed_at timestamptz;
