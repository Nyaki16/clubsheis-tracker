-- 0028: Sales milestones and Ghutte onboarding automation.
-- Proposal Accepted (ticked by the team) tags the contact in ClubSheIs's GHL so
-- a workflow runs; Ghutte Payment Made is ticked by GHL's payment webhook (or by
-- hand). Once both are done the Tracker creates the client's Ghutte
-- sub-account, adds them as a user and emails their login.

alter table clients
  add column if not exists proposal_accepted_at timestamptz,
  add column if not exists proposal_accepted_by uuid references profiles(id) on delete set null,
  add column if not exists ghutte_paid_at timestamptz,
  add column if not exists ghutte_payment jsonb,
  add column if not exists ghl_contact_id text,
  add column if not exists ghutte_location_id text,
  add column if not exists ghutte_user_id text,
  add column if not exists ghutte_login_sent_at timestamptz,
  add column if not exists ghutte_error text;

create index if not exists clients_ghl_contact_idx on clients(ghl_contact_id);
