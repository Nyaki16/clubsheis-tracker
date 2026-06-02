-- CSI Home: asset register, SOPs, and vault links.
--
-- vault_links stores a label + URL (e.g. a 1Password share or shared
-- Bitwarden entry). We do NOT store raw passwords — keep those in the
-- dedicated password manager.

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'other',
  serial text not null default '',
  assigned_to uuid references profiles(id) on delete set null,
  purchased_on date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assets_assigned_to_idx on assets(assigned_to);

create table if not exists sops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sops_category_idx on sops(category);

create table if not exists vault_links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

notify pgrst, 'reload schema';
