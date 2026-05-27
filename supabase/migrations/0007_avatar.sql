-- User profile pictures.
-- Adds avatar_url to profiles + an "avatars" Storage bucket with public read
-- and authenticated write.

alter table profiles
  add column if not exists avatar_url text;

-- Public read so <img src> works without a session token.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone signed in can upload an avatar to a path that starts with their
-- user id (e.g. "<uid>/file.png"). Updates/deletes scoped the same way so
-- one user cannot overwrite another user's file.
drop policy if exists "avatars: insert own" on storage.objects;
create policy "avatars: insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: update own" on storage.objects;
create policy "avatars: update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: delete own" on storage.objects;
create policy "avatars: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: read all" on storage.objects;
create policy "avatars: read all"
  on storage.objects for select to public
  using (bucket_id = 'avatars');
