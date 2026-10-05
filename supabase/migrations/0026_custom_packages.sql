-- 0026: one package list for client flows and New job. The six original
-- packages and the seven job-bank packages (Bronze … Full Funnel Build) move
-- into a table, and the team can add their own in Settings → Package templates.

create table if not exists packages (
  id text primary key,
  label text not null,
  short text not null default '',
  description text not null default '',
  position int not null default 0,
  job_name text not null default '',
  builtin boolean not null default false,
  created_at timestamptz not null default now()
);

insert into packages (id, label, short, description, position, builtin) values
  ('lead',    'Package not chosen',    'No package yet',       'Sales tasks only until you pick', 0, true),
  ('ghutte',  'Ghutte Only',           'Ghutte Only',          'Onboarding onto Ghutte',          1, true),
  ('page',    'New Page Build',        'New Page Build',       'One page built in Ghutte',        2, true),
  ('content', 'Content Day',           'Content Day',          'Long + short form in studio',     3, true),
  ('ads',     'Ads + Email + Social',  'Ads + Email + Social', 'Meta ads, newsletters, social',   4, true),
  ('full',    'Full Build',            'Full Build',           'Lead magnet, OTO, main product',  5, true)
on conflict (id) do nothing;

-- The job bank (what New job used to offer as templates).
insert into packages (id, label, short, description, job_name, position, builtin) values
  ('bronze', 'Small Business — Bronze', 'Bronze', 'R3,800/mo · Ghutte access + tutorials + monthly strategy session', 'Bronze — Monthly cycle', 10, true),
  ('silver', 'Small Business — Silver', 'Silver', 'R5,500/mo · Strategy + 12 posts/mo (4 reels, 8 static)', 'Silver — Monthly cycle', 11, true),
  ('gold_obm', 'Small Business — Gold / OBM', 'Gold / OBM', 'R7,500/mo (3-mo min) · Workflow + system + Ghutte migration', 'Gold / OBM — Onboarding & system build', 12, true),
  ('ads_only', 'OBM Growth — Ads Only', 'Ads Only', 'R12,500/mo · Meta ads + website audit + automation (no newsletters)', 'Ads Only — Monthly cycle', 13, true),
  ('ads_email', 'OBM Visibility & Growth — Ads + Email', 'Ads + Email', 'R18,500/mo · Ads + 2 newsletters/mo', 'Ads + Email — Monthly cycle', 14, true),
  ('ads_email_social', 'OBM Visibility & Growth — Ads + Email + Social', 'OBM Ads + Email + Social', 'R25,000/mo · Ads + 4 newsletters + 16 posts/mo + automation', 'Full Service — Monthly cycle', 15, true),
  ('full_funnel', 'Full Funnel Build', 'Full Funnel', 'R32,500+ one-time · Sales pages + email automation + ads', 'Full Funnel Build', 16, true)
on conflict (id) do nothing;

alter table packages enable row level security;
drop policy if exists "team can do everything" on packages;
create policy "team can do everything" on packages for all to authenticated using (true) with check (true);

-- The old fixed lists of package ids no longer apply.
do $$
declare c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('clients'::regclass, 'flow_templates'::regclass)
      and pg_get_constraintdef(oid) ilike '%package%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

-- Job-bank tasks: Sales + Onboarding first (skipped for clients who are already
-- onboarded, whose new job gets only Production + Delivery), then the work.
do $$
begin
  if not exists (select 1 from flow_templates where package = 'bronze') then
    -- the usual Sales + Onboarding steps, copied from Full Build
    insert into flow_templates (package, phase, position, title, tool, default_assignee_id)
      select 'bronze', phase, position, title, tool, default_assignee_id
      from flow_templates where package = 'full' and phase in ('sales', 'onboarding');
    insert into flow_templates (package, phase, position, title) values
    ('bronze', 'production', 100, 'Send Ghutte platform login & onboarding email'),
    ('bronze', 'production', 101, 'Confirm video tutorial library access'),
    ('bronze', 'production', 102, 'Schedule monthly 1-hour strategy session'),
    ('bronze', 'production', 103, 'Run strategy session'),
    ('bronze', 'delivery', 104, 'Send recap & action items');
  end if;
  if not exists (select 1 from flow_templates where package = 'silver') then
    -- the usual Sales + Onboarding steps, copied from Full Build
    insert into flow_templates (package, phase, position, title, tool, default_assignee_id)
      select 'silver', phase, position, title, tool, default_assignee_id
      from flow_templates where package = 'full' and phase in ('sales', 'onboarding');
    insert into flow_templates (package, phase, position, title) values
    ('silver', 'production', 100, 'Schedule 30-min monthly strategy call'),
    ('silver', 'production', 101, 'Run strategy call & confirm content direction'),
    ('silver', 'production', 102, 'Confirm Ghutte platform access'),
    ('silver', 'production', 103, 'Ideate 4 Reel concepts'),
    ('silver', 'production', 104, 'Script 4 Reels'),
    ('silver', 'production', 105, 'Shoot/source footage for 4 Reels'),
    ('silver', 'production', 106, 'Edit 4 Reels'),
    ('silver', 'production', 107, 'Design 8 static feed posts'),
    ('silver', 'production', 108, 'Write captions for all 12 posts'),
    ('silver', 'production', 109, 'Client approval round'),
    ('silver', 'production', 110, 'Schedule 12 posts to platforms'),
    ('silver', 'delivery', 111, 'Send monthly recap');
  end if;
  if not exists (select 1 from flow_templates where package = 'gold_obm') then
    -- the usual Sales + Onboarding steps, copied from Full Build
    insert into flow_templates (package, phase, position, title, tool, default_assignee_id)
      select 'gold_obm', phase, position, title, tool, default_assignee_id
      from flow_templates where package = 'full' and phase in ('sales', 'onboarding');
    insert into flow_templates (package, phase, position, title) values
    ('gold_obm', 'production', 100, 'Map current sales workflow'),
    ('gold_obm', 'production', 101, 'Design optimised workflow'),
    ('gold_obm', 'production', 102, 'Migrate client to Ghutte platform'),
    ('gold_obm', 'production', 103, 'Set up sales workflow inside Ghutte'),
    ('gold_obm', 'production', 104, 'Configure email templates'),
    ('gold_obm', 'production', 105, 'Configure ads (basic setup)'),
    ('gold_obm', 'delivery', 106, 'Run personal training session'),
    ('gold_obm', 'delivery', 107, 'Hand over onboarding documentation'),
    ('gold_obm', 'delivery', 108, 'Monthly check-in');
  end if;
  if not exists (select 1 from flow_templates where package = 'ads_only') then
    -- the usual Sales + Onboarding steps, copied from Full Build
    insert into flow_templates (package, phase, position, title, tool, default_assignee_id)
      select 'ads_only', phase, position, title, tool, default_assignee_id
      from flow_templates where package = 'full' and phase in ('sales', 'onboarding');
    insert into flow_templates (package, phase, position, title) values
    ('ads_only', 'production', 100, 'Audit website'),
    ('ads_only', 'production', 101, 'Apply website updates'),
    ('ads_only', 'production', 102, 'Optimise social media profiles'),
    ('ads_only', 'production', 103, 'Set up Meta ads campaigns (per product category)'),
    ('ads_only', 'production', 104, 'Set up email automation flows'),
    ('ads_only', 'production', 105, 'Monitor & optimise ads weekly'),
    ('ads_only', 'delivery', 106, 'Run 1-hour monthly check-in'),
    ('ads_only', 'delivery', 107, 'Send recap & next-month plan');
  end if;
  if not exists (select 1 from flow_templates where package = 'ads_email') then
    -- the usual Sales + Onboarding steps, copied from Full Build
    insert into flow_templates (package, phase, position, title, tool, default_assignee_id)
      select 'ads_email', phase, position, title, tool, default_assignee_id
      from flow_templates where package = 'full' and phase in ('sales', 'onboarding');
    insert into flow_templates (package, phase, position, title) values
    ('ads_email', 'production', 100, 'Audit website & strategy'),
    ('ads_email', 'production', 101, 'Set up/optimise Meta ads'),
    ('ads_email', 'production', 102, 'Plan 2 monthly newsletters'),
    ('ads_email', 'production', 103, 'Write & design newsletter 1'),
    ('ads_email', 'production', 104, 'Write & design newsletter 2'),
    ('ads_email', 'production', 105, 'Schedule newsletters'),
    ('ads_email', 'production', 106, 'Optimise social profiles'),
    ('ads_email', 'production', 107, 'Monitor ads weekly'),
    ('ads_email', 'delivery', 108, 'Run 60-min monthly check-in & strategy call'),
    ('ads_email', 'delivery', 109, 'Send recap & next-month plan');
  end if;
  if not exists (select 1 from flow_templates where package = 'ads_email_social') then
    -- the usual Sales + Onboarding steps, copied from Full Build
    insert into flow_templates (package, phase, position, title, tool, default_assignee_id)
      select 'ads_email_social', phase, position, title, tool, default_assignee_id
      from flow_templates where package = 'full' and phase in ('sales', 'onboarding');
    insert into flow_templates (package, phase, position, title) values
    ('ads_email_social', 'production', 100, 'Strategy: confirm monthly content pillars'),
    ('ads_email_social', 'production', 101, 'Set up/optimise Meta ads'),
    ('ads_email_social', 'production', 102, 'Plan 4 weekly newsletters'),
    ('ads_email_social', 'production', 103, 'Write & design newsletter 1'),
    ('ads_email_social', 'production', 104, 'Write & design newsletter 2'),
    ('ads_email_social', 'production', 105, 'Write & design newsletter 3'),
    ('ads_email_social', 'production', 106, 'Write & design newsletter 4'),
    ('ads_email_social', 'production', 107, 'Plan 16 social posts'),
    ('ads_email_social', 'production', 108, 'Create/source assets for 16 posts'),
    ('ads_email_social', 'production', 109, 'Write captions for 16 posts'),
    ('ads_email_social', 'production', 110, 'Schedule 16 posts (weekly cadence)'),
    ('ads_email_social', 'production', 111, 'Set up/maintain email automation flows'),
    ('ads_email_social', 'production', 112, 'Website maintenance (min 2 hrs)'),
    ('ads_email_social', 'production', 113, 'Monitor ads weekly'),
    ('ads_email_social', 'delivery', 114, 'Run 60-min monthly check-in'),
    ('ads_email_social', 'delivery', 115, 'Send monthly recap');
  end if;
  if not exists (select 1 from flow_templates where package = 'full_funnel') then
    -- the usual Sales + Onboarding steps, copied from Full Build
    insert into flow_templates (package, phase, position, title, tool, default_assignee_id)
      select 'full_funnel', phase, position, title, tool, default_assignee_id
      from flow_templates where package = 'full' and phase in ('sales', 'onboarding');
    insert into flow_templates (package, phase, position, title) values
    ('full_funnel', 'production', 100, 'Discovery & funnel strategy session'),
    ('full_funnel', 'production', 101, 'Map funnel architecture'),
    ('full_funnel', 'production', 102, 'Write sales page copy'),
    ('full_funnel', 'production', 103, 'Design sales page'),
    ('full_funnel', 'production', 104, 'Build sales page in Ghutte'),
    ('full_funnel', 'production', 105, 'Build thank-you / OTO page'),
    ('full_funnel', 'production', 106, 'Set up checkout & payment integration'),
    ('full_funnel', 'production', 107, 'Write email automation sequence'),
    ('full_funnel', 'production', 108, 'Build email automation in Ghutte'),
    ('full_funnel', 'production', 109, 'Set up Meta ads campaigns'),
    ('full_funnel', 'production', 110, 'QA full funnel end-to-end'),
    ('full_funnel', 'delivery', 111, 'Client walkthrough & training'),
    ('full_funnel', 'delivery', 112, 'Launch funnel'),
    ('full_funnel', 'delivery', 113, 'Post-launch optimisation review');
  end if;
end $$;
