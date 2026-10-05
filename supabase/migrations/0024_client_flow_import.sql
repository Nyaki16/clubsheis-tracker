-- Remember which Client Flow record a Tracker client came from, so the
-- one-off import can be re-run safely without creating duplicates.

alter table clients
  add column if not exists client_flow_id text;

create unique index if not exists clients_client_flow_id_key
  on clients(client_flow_id) where client_flow_id is not null;

notify pgrst, 'reload schema';
