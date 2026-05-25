-- Manual override URLs for the four client-flow documents.
-- Tracker auto-pulls these from the client-flow Supabase when configured,
-- but a manual URL here takes precedence (in case the auto-match misses).

alter table clients
  add column if not exists client_profile_doc_url text,
  add column if not exists research_bible_doc_url text,
  add column if not exists brand_voice_doc_url text,
  add column if not exists strategy_brief_doc_url text;
