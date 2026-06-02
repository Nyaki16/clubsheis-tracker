-- Add a new task status: internally_reviewed.
-- Workflow: In Review (sent to internal approver) → Internally Reviewed
-- (approver ticked Approved) → Awaiting Client Approval / Published / etc.

alter table tasks
  drop constraint if exists tasks_status_check;

alter table tasks
  add constraint tasks_status_check
  check (status in (
    'planning',
    'in_progress',
    'in_review',
    'internally_reviewed',
    'awaiting_client',
    'published',
    'closed_out'
  ));

notify pgrst, 'reload schema';
