-- URL link, send-for-approval (to whom), and approved tick on each task.

alter table tasks
  add column if not exists url text,
  add column if not exists sent_for_approval boolean not null default false,
  add column if not exists approver_id uuid references profiles(id) on delete set null,
  add column if not exists approved boolean not null default false;
