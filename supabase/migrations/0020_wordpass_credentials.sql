-- Wordpass entries now hold a username + password as well as the existing
-- label / URL / notes. Plaintext storage — admins with DB access can read
-- everything; treat this as a shared team password sheet, not a vault.

alter table vault_links
  add column if not exists username text,
  add column if not exists password text;

notify pgrst, 'reload schema';
