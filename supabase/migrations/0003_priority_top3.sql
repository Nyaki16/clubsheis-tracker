-- Top 3 priorities, per-assignee.
-- Each task may carry a priority_rank of 1, 2, or 3. Uniqueness of
-- (assignee_id, priority_rank) where rank is set caps each assignee at three
-- ranked tasks. Reassigning a task clears its rank so a priority always
-- belongs to the person who currently owns it.

alter table tasks
  add column if not exists priority_rank integer
    check (priority_rank is null or priority_rank in (1, 2, 3));

-- Ranks only apply to assigned tasks (per-person Top 3).
alter table tasks
  drop constraint if exists tasks_priority_requires_assignee;
alter table tasks
  add constraint tasks_priority_requires_assignee
  check (priority_rank is null or assignee_id is not null);

-- One row per (assignee, rank) — hard cap of three per person.
create unique index if not exists tasks_assignee_priority_unique
  on tasks (assignee_id, priority_rank)
  where priority_rank is not null;

create index if not exists tasks_priority_rank_idx
  on tasks (priority_rank)
  where priority_rank is not null;

-- When a task is reassigned (or unassigned), drop its Top 3 rank.
create or replace function public.clear_priority_on_reassign()
returns trigger
language plpgsql
as $$
begin
  if new.assignee_id is distinct from old.assignee_id then
    new.priority_rank := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_clear_priority_on_reassign on tasks;
create trigger tasks_clear_priority_on_reassign
  before update on tasks
  for each row execute function public.clear_priority_on_reassign();
