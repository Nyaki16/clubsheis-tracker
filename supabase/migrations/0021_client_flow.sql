-- Client flow inside the Tracker (replaces the separate clubsheis-client-flow app).
--
-- Every client gets one "flow" job holding the tasks issued from their package's
-- template. Tasks carry the phase they belong to and an optional built-in tool
-- (discovery notes, proposal, checklist, Yellow Sheet, AI generator…) whose
-- working data lives in tasks.tool_state.
--
-- Additive only: existing jobs/tasks keep working unchanged. Safe to re-run.

-- -------------------------------------------------------------------------
-- clients: contact details, package, lead + calendar booking info
-- -------------------------------------------------------------------------
alter table clients
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists package text
    check (package in ('lead','ghutte','page','content','ads','full')),
  add column if not exists lead_id uuid references profiles(id) on delete set null,
  add column if not exists is_past_lead boolean not null default false,
  add column if not exists source text not null default 'manual'
    check (source in ('manual','calendar','client_flow')),
  add column if not exists call_at timestamptz,
  add column if not exists call_title text,
  add column if not exists call_event_id text,
  add column if not exists call_notes_url text,
  add column if not exists call_message text,
  add column if not exists clock_started_on date;

create unique index if not exists clients_call_event_id_key
  on clients(call_event_id) where call_event_id is not null;
create index if not exists clients_email_idx on clients(lower(email));

-- -------------------------------------------------------------------------
-- jobs: one flow job per client
-- -------------------------------------------------------------------------
alter table jobs
  add column if not exists kind text not null default 'job'
    check (kind in ('job','flow'));

create unique index if not exists jobs_one_flow_per_client
  on jobs(client_id) where kind = 'flow';

-- -------------------------------------------------------------------------
-- tasks: phase, built-in tool, tool data, order within the phase
-- -------------------------------------------------------------------------
alter table tasks
  add column if not exists phase text
    check (phase in ('sales','onboarding','yellow','production','delivery')),
  add column if not exists tool text,
  add column if not exists tool_state jsonb not null default '{}'::jsonb,
  add column if not exists position integer;

create index if not exists tasks_job_phase_idx on tasks(job_id, phase, position);

-- -------------------------------------------------------------------------
-- flow_templates: the tasks each package issues (edited in Settings)
-- -------------------------------------------------------------------------
create table if not exists flow_templates (
  id uuid primary key default gen_random_uuid(),
  package text not null check (package in ('lead','ghutte','page','content','ads','full')),
  phase text not null check (phase in ('sales','onboarding','yellow','production','delivery')),
  position integer not null default 0,
  title text not null,
  tool text,
  default_assignee_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists flow_templates_package_idx on flow_templates(package, phase, position);

-- -------------------------------------------------------------------------
-- pricing_tiers: what the proposal generator chooses from (edited in Settings)
-- -------------------------------------------------------------------------
create table if not exists pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount integer not null default 0,
  cadence text not null default 'month' check (cadence in ('month','once')),
  min_months integer not null default 0,
  is_from boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- Closing "Start the 14-day clock" starts the client's countdown, from
-- wherever the task gets closed (client page, Home, Daily Scroll…).
-- -------------------------------------------------------------------------
create or replace function public.start_client_clock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.title = 'Start the 14-day clock'
     and new.status in ('published','closed_out')
     and (tg_op = 'INSERT' or old.status not in ('published','closed_out')) then
    update clients
       set clock_started_on = coalesce(clock_started_on, current_date)
     where id = (select client_id from jobs where id = new.job_id);
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_start_client_clock on tasks;
create trigger tasks_start_client_clock
  after insert or update of status on tasks
  for each row execute function public.start_client_clock();

-- -------------------------------------------------------------------------
-- RLS — same rule as the rest of the app: any signed-in team member
-- -------------------------------------------------------------------------
alter table flow_templates enable row level security;
alter table pricing_tiers enable row level security;

drop policy if exists "team can do everything on flow_templates" on flow_templates;
create policy "team can do everything on flow_templates" on flow_templates
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "team can do everything on pricing_tiers" on pricing_tiers;
create policy "team can do everything on pricing_tiers" on pricing_tiers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- -------------------------------------------------------------------------
-- Seed templates (only when empty). Owners resolve by email, then by name.
-- -------------------------------------------------------------------------
do $$
declare
  gizelle uuid := (select id from profiles where lower(email) like 'gizelle@%' or name ilike 'gizelle%' limit 1);
  mpume   uuid := (select id from profiles where lower(email) like 'mpume@%'   or name ilike 'mpume%'   limit 1);
  xoli    uuid := (select id from profiles where lower(email) like 'xoli%@%'   or name ilike 'xoli%'    limit 1);
  nyaki   uuid := (select id from profiles where lower(email) like 'nyaki@%'   or name ilike 'nyaki%'   limit 1);
begin
  if exists (select 1 from flow_templates) then return; end if;

  -- Sales (every package except Ghutte Only and Content Day)
  insert into flow_templates (package, phase, position, title, tool, default_assignee_id)
  select p, 'sales', pos, title, tool, owner from
    (values ('lead'),('page'),('ads'),('full')) as pk(p),
    (values (1,'Discovery call + notes','discovery',gizelle),
            (2,'Proposal','proposal',gizelle),
            (3,'Follow up on proposal',null,gizelle)) as t(pos,title,tool,owner);

  -- Ghutte Only
  insert into flow_templates (package, phase, position, title, tool, default_assignee_id) values
    ('ghutte','onboarding',1,'Create Ghutte sub-account','account',mpume),
    ('ghutte','onboarding',2,'Onboarding Call','checklist',gizelle);

  -- Onboarding + Yellow Sheet (page, ads, full)
  insert into flow_templates (package, phase, position, title, tool, default_assignee_id)
  select p, phase, pos, title, tool, owner from
    (values ('page'),('ads'),('full')) as pk(p),
    (values ('onboarding',1,'Create Ghutte sub-account','account',mpume),
            ('onboarding',2,'Technical setup','checklist',mpume),
            ('onboarding',3,'Start the 14-day clock',null,gizelle),
            ('yellow',1,'Yellow Sheet','yellow',gizelle),
            ('yellow',2,'Sales page copy','gen',gizelle),
            ('yellow',3,'7-email sequence','gen',gizelle),
            ('yellow',4,'1 month of content','gen',xoli)) as t(phase,pos,title,tool,owner);

  -- Production
  insert into flow_templates (package, phase, position, title, tool, default_assignee_id) values
    ('page','production',1,'Build the page in Ghutte',null,mpume),
    ('page','production',2,'Connect Domain & Payments',null,mpume),
    ('content','production',1,'Content plan + scripts','gen',xoli),
    ('content','production',2,'Book the studio',null,gizelle),
    ('content','production',3,'Shoot day',null,xoli),
    ('content','production',4,'Edit long-form video',null,xoli),
    ('content','production',5,'Edit short-form clips',null,xoli),
    ('ads','production',1,'Ad copy','gen',gizelle),
    ('ads','production',2,'Ad creatives',null,xoli),
    ('ads','production',3,'Launch Meta campaigns',null,gizelle),
    ('ads','production',4,'Email newsletters','gen',gizelle),
    ('ads','production',5,'Social calendar + posts',null,xoli),
    ('full','production',1,'Pre-production prompts','gen',mpume),
    ('full','production',2,'Build lead magnet',null,mpume),
    ('full','production',3,'Build OTO page',null,mpume),
    ('full','production',4,'Build main product page',null,mpume);

  -- Delivery
  insert into flow_templates (package, phase, position, title, tool, default_assignee_id)
  select p, 'delivery', pos, title, tool, owner from
    (values ('page'),('content'),('ads'),('full')) as pk(p),
    (values (1,'Internal check','gen',nyaki),
            (2,'Client review + approval',null,gizelle),
            (3,'Hand over','gen',gizelle)) as t(pos,title,tool,owner);
  insert into flow_templates (package, phase, position, title, tool, default_assignee_id) values
    ('ads','delivery',4,'Set up monthly retainer cycle',null,gizelle),
    ('page','delivery',4,'Wrap-up + offboarding',null,gizelle),
    ('full','delivery',4,'Wrap-up + offboarding',null,gizelle);
end $$;

-- -------------------------------------------------------------------------
-- Seed pricing (only when empty)
-- -------------------------------------------------------------------------
insert into pricing_tiers (name, amount, cadence, min_months, is_from, position)
select * from (values
  ('Small Business · Bronze',               3800,  'month', 0, false, 1),
  ('Small Business · Silver',               5500,  'month', 0, false, 2),
  ('Small Business · Gold / OBM',           7500,  'month', 3, false, 3),
  ('OBM Growth Support',                    12500, 'month', 0, false, 4),
  ('OBM Visibility & Growth · Ads + Email', 18500, 'month', 0, false, 5),
  ('OBM Visibility & Growth · Full',        25000, 'month', 0, false, 6),
  ('Custom Full Funnel Build',              32500, 'once',  0, true,  7),
  ('Ghutte Page Build',                     7600,  'once',  0, false, 8),
  ('Ghutte Monthly Subscription',           1800,  'month', 0, false, 9),
  ('Ghutte Premium Monthly Subscription',   3600,  'month', 0, false, 10)
) as v(name, amount, cadence, min_months, is_from, position)
where not exists (select 1 from pricing_tiers);

notify pgrst, 'reload schema';
