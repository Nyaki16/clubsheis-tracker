-- Client profile: business name, about, contact links, brand assets.
-- Run this in the Supabase SQL editor.

alter table clients
  add column if not exists business_name text,
  add column if not exists about text,
  add column if not exists profile_pic_url text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text,
  add column if not exists facebook_url text,
  add column if not exists linkedin_url text,
  add column if not exists youtube_url text,
  add column if not exists website_url text,
  add column if not exists google_drive_url text,
  add column if not exists canva_brand_url text;
