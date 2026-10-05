-- Calendar sync: discovery calls booked in info@clubsheis.com's calendar
-- become clients. A Google Apps Script running as that account sends the
-- events (with any "Notes by Gemini" text) to /api/calendar/ingest.
-- Additive and safe to re-run.

alter table clients
  add column if not exists call_notes text,
  add column if not exists call_cancelled boolean not null default false;

-- Small key/value store for app-wide state (e.g. the last calendar sync).
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

drop policy if exists "team can do everything on app_settings" on app_settings;
create policy "team can do everything on app_settings" on app_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
