-- Optional time-of-day for client dates (e.g. 14:30 webinar start).

alter table client_dates
  add column if not exists time time;

notify pgrst, 'reload schema';
