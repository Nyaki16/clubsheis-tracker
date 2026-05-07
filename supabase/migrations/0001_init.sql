-- ClubSheIs Production Tracker — initial schema
-- Run this in the Supabase SQL editor.

-- =========================================================================
-- profiles: linked 1:1 to auth.users, auto-populated on sign up
-- =========================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'name',
      initcap(split_part(new.email, '@', 1))
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- clients
-- =========================================================================
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#8B5CF6',
  created_at timestamptz not null default now()
);

-- =========================================================================
-- jobs
-- =========================================================================
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  stage text not null default 'briefing'
    check (stage in ('briefing','planning','scripts','shoot','edit','qa','delivered')),
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists jobs_client_id_idx on jobs(client_id);

-- =========================================================================
-- tasks
-- =========================================================================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  title text not null,
  assignee_id uuid references profiles(id) on delete set null,
  due_date date,
  notes text not null default '',
  status text not null default 'planning'
    check (status in ('planning','in_progress','in_review','awaiting_client','published','closed_out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_job_id_idx on tasks(job_id);
create index if not exists tasks_assignee_id_idx on tasks(assignee_id);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists tasks_due_date_idx on tasks(due_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function public.set_updated_at();

-- =========================================================================
-- deliverables
-- =========================================================================
create table if not exists deliverables (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  name text not null,
  status text not null default 'in_progress'
    check (status in ('in_progress','delivered','client_reviewing','revision_requested','revised','approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deliverables_job_id_idx on deliverables(job_id);

drop trigger if exists deliverables_set_updated_at on deliverables;
create trigger deliverables_set_updated_at
  before update on deliverables
  for each row execute function public.set_updated_at();

-- =========================================================================
-- Row Level Security — any authenticated user can read/write
-- (internal team app, account creation gated via Supabase auth settings)
-- =========================================================================
alter table profiles enable row level security;
alter table clients enable row level security;
alter table jobs enable row level security;
alter table tasks enable row level security;
alter table deliverables enable row level security;

drop policy if exists "team can read profiles" on profiles;
create policy "team can read profiles" on profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile" on profiles
  for update using (auth.uid() = id);

drop policy if exists "team can do everything on clients" on clients;
create policy "team can do everything on clients" on clients
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "team can do everything on jobs" on jobs;
create policy "team can do everything on jobs" on jobs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "team can do everything on tasks" on tasks;
create policy "team can do everything on tasks" on tasks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "team can do everything on deliverables" on deliverables;
create policy "team can do everything on deliverables" on deliverables
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =========================================================================
-- Seed sample clients (safe to re-run; only inserts if table is empty)
-- =========================================================================
insert into clients (name, color)
select * from (values
  ('Palesa Dooms', '#8B5CF6'),
  ('Motshabi (Kay Nutrihealth)', '#EC4899'),
  ('Sibu Sibaca', '#F59E0B'),
  ('Link Interiors', '#10B981')
) as v(name, color)
where not exists (select 1 from clients);
