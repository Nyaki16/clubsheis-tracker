-- 0029: Operational clients. null = automatic (their client flow is finished,
-- or they're an existing client with jobs but no flow); true / false = the
-- team moved them in or out by hand.
alter table clients add column if not exists operational boolean;
