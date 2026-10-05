-- 0027: Project briefs. One-page briefs for the team, written by AI from a
-- client's discovery notes, meetings, links and pasted notes, edited by the
-- team, and sent to a staff member as a task. A client can have many.

create table if not exists project_briefs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null default 'Project brief',
  content text not null default '',
  -- What it was written from, e.g. ["Discovery call", "Team Scroll · 5 Oct", "https://…"]
  sources jsonb not null default '[]',
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_briefs_client_idx on project_briefs(client_id, created_at desc);

alter table project_briefs enable row level security;
drop policy if exists "team can do everything on project_briefs" on project_briefs;
create policy "team can do everything on project_briefs" on project_briefs
  for all to authenticated using (true) with check (true);

-- A task sent from a brief points back at it.
alter table tasks add column if not exists brief_id uuid references project_briefs(id) on delete set null;
create index if not exists tasks_brief_idx on tasks(brief_id);
