-- A reserved internal client + job to host system-generated tasks
-- (leave approvals, future HR automations).

insert into clients (id, name, color)
  values ('00000000-0000-0000-0000-000000000001', 'CSI Internal', '#64748b')
  on conflict (id) do nothing;

insert into jobs (id, client_id, name, stage, due_date)
  values (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'HR — Leave approvals',
    'planning',
    null
  )
  on conflict (id) do nothing;

-- Link tasks back to a leave_request so we can close them automatically
-- when the request is decided / cancelled.
alter table tasks
  add column if not exists leave_request_id uuid
    references leave_requests(id) on delete cascade;

create index if not exists tasks_leave_request_id_idx
  on tasks(leave_request_id);

notify pgrst, 'reload schema';
