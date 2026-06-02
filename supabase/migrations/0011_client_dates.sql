-- Important dates attached to a client (launches, content drops, anniversaries,
-- end-of-month deadlines, etc). Aggregated on the Calendar page.

create table if not exists client_dates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  date date not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists client_dates_client_id_idx on client_dates(client_id);
create index if not exists client_dates_date_idx on client_dates(date);

notify pgrst, 'reload schema';
