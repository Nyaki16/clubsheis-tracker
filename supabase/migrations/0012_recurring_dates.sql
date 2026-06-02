-- Recurring client dates: store the rule on the base row and expand at read
-- time. recurrence is one of: none, daily, weekly, monthly, yearly.

alter table client_dates
  add column if not exists recurrence text not null default 'none',
  add column if not exists recurrence_until date;

alter table client_dates
  drop constraint if exists client_dates_recurrence_check;

alter table client_dates
  add constraint client_dates_recurrence_check
  check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly'));

notify pgrst, 'reload schema';
