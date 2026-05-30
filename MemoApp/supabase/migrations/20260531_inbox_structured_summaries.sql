-- Structured inbox summaries for card display, vector search, and detail view.

alter table public.inbox_sessions
  add column if not exists summary_one_liner text,
  add column if not exists summary_search_text text,
  add column if not exists summary_detail text;

update public.inbox_sessions
set
  summary_one_liner = coalesce(summary_one_liner, summary),
  summary_search_text = coalesce(summary_search_text, summary),
  summary_detail = coalesce(summary_detail, summary)
where summary is not null;
