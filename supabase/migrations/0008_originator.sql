-- Remember who handed a task off for approval so we can give it back to
-- them once the approver ticks Approved.

alter table tasks
  add column if not exists originator_id uuid
    references profiles(id) on delete set null;

notify pgrst, 'reload schema';
