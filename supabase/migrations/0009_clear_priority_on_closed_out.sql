-- When a task moves to "closed_out", drop any Top 3 priority on it so the
-- assignee's Top 3 frees up automatically.
--
-- Extends the existing clear_priority_on_reassign trigger function with a
-- second clause and renames the function for clarity.

create or replace function public.clear_priority_on_reassign()
returns trigger
language plpgsql
as $$
begin
  if new.assignee_id is distinct from old.assignee_id then
    new.priority_rank := null;
  end if;
  if new.status = 'closed_out' and (old.status is null or old.status <> 'closed_out') then
    new.priority_rank := null;
  end if;
  return new;
end;
$$;

-- Also clear any rank currently sitting on already-closed_out tasks.
update tasks set priority_rank = null
  where status = 'closed_out' and priority_rank is not null;
