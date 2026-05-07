-- Admin role: lets a designated user invite teammates from the app.
-- Run this in the Supabase SQL editor after 0001_init.sql.

alter table profiles
  add column if not exists is_admin boolean not null default false;

-- Promote the oldest existing profile to admin if no admin exists yet.
-- Adjust manually afterwards with:
--   update profiles set is_admin = true where email = 'someone@example.com';
update profiles
  set is_admin = true
  where id = (select id from profiles order by created_at asc limit 1)
  and not exists (select 1 from profiles where is_admin = true);

-- Only admins may flip the is_admin bit; everyone else keeps the existing
-- "users can update own profile" policy (added in 0001) for name/email edits.
drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile" on profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = (select is_admin from profiles where id = auth.uid())
  );

drop policy if exists "admins can update any profile" on profiles;
create policy "admins can update any profile" on profiles
  for update using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  ) with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
