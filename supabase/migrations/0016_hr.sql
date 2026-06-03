-- HR: personal info on profiles + leave-request workflow.

alter table profiles
  add column if not exists surname text,
  add column if not exists cellphone text,
  add column if not exists home_address text,
  add column if not exists next_of_kin text,
  add column if not exists next_of_kin_phone text,
  add column if not exists id_document_url text,
  add column if not exists job_title text,
  add column if not exists start_date date,
  add column if not exists annual_leave_allowance integer not null default 20;

create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  approver_id uuid references profiles(id) on delete set null,
  start_date date not null,
  end_date date not null,
  days numeric(4,1) not null,
  reason text not null default '',
  status text not null default 'pending',
  decided_at timestamptz,
  decided_notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists leave_requests_requester_idx
  on leave_requests(requester_id);
create index if not exists leave_requests_status_idx
  on leave_requests(status);

alter table leave_requests
  drop constraint if exists leave_requests_status_check;
alter table leave_requests
  add constraint leave_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled'));

notify pgrst, 'reload schema';
