-- Category definitions stay local UI preferences. The block keeps the opaque
-- id so deleting a local category can reset its associated events after sync.
alter table public.calendar_blocks
  add column if not exists category_id uuid null;
