-- SOPs often live in Google Docs / Notion. Store an optional canonical URL.

alter table sops
  add column if not exists url text;

notify pgrst, 'reload schema';
