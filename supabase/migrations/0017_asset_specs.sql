-- Asset Register: hardware spec columns.

alter table assets
  add column if not exists model text,
  add column if not exists processor text,
  add column if not exists memory text,
  add column if not exists os text,
  add column if not exists graphics text;

notify pgrst, 'reload schema';
