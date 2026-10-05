-- Debbie: the Tracker's memory of every meeting, and the AI built on it.
--
-- meetings          every meeting with notes — Team Scroll, Boardroom, client
--                   calls, one-on-ones — from info@clubsheis.com's calendar
--                   (Gemini notes) or added by hand. Full-text searchable.
-- meeting_clients   which clients a meeting involved.
-- client_documents  versions of each client's Profile and Strategy Brief,
--                   written by Debbie (or edited by the team).
-- debbie_chats / debbie_messages   conversations with Ask Debbie.
-- tasks.debbie_*    "Debbie Recommends" tasks she adds after Team Scroll.
-- Additive and safe to re-run.

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,
  title text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  kind text not null default 'other'
    check (kind in ('team_scroll','boardroom','client','discovery','one_on_one','internal','other')),
  attendees jsonb not null default '[]'::jsonb,
  notes text not null default '',
  notes_url text,
  source text not null default 'calendar' check (source in ('calendar','manual')),
  created_by uuid references profiles(id) on delete set null,
  debbie_processed_at timestamptz,
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_starts_idx on meetings(starts_at desc);
create index if not exists meetings_kind_idx on meetings(kind, starts_at desc);
create index if not exists meetings_search_idx on meetings using gin(search);

create table if not exists meeting_clients (
  meeting_id uuid not null references meetings(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  primary key (meeting_id, client_id)
);
create index if not exists meeting_clients_client_idx on meeting_clients(client_id);

create table if not exists client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null check (kind in ('profile','strategy')),
  content text not null,
  sources text not null default '',
  created_by uuid references profiles(id) on delete set null, -- null = written by Debbie
  gdoc_written boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists client_documents_latest_idx on client_documents(client_id, kind, created_at desc);

create table if not exists debbie_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists debbie_chats_user_idx on debbie_chats(user_id, updated_at desc);

create table if not exists debbie_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references debbie_chats(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content jsonb not null,   -- API content blocks, replayed unchanged
  text text not null default '', -- what the UI shows
  created_at timestamptz not null default now()
);
create index if not exists debbie_messages_chat_idx on debbie_messages(chat_id, created_at);

alter table clients
  add column if not exists docs_dirty_at timestamptz,
  add column if not exists profile_gdoc_id text,
  add column if not exists strategy_gdoc_id text;

alter table tasks
  add column if not exists debbie_recommended boolean not null default false,
  add column if not exists debbie_source jsonb;

-- Ranked search with highlighted snippets, for Debbie and the documents.
create or replace function public.search_meetings(
  q text,
  date_from timestamptz default null,
  date_to timestamptz default null,
  kinds text[] default null,
  for_client uuid default null,
  lim int default 12
)
returns table (id uuid, title text, starts_at timestamptz, kind text, snippet text, rank real)
language sql stable
set search_path = public
as $$
  select m.id, m.title, m.starts_at, m.kind,
         ts_headline('english', m.notes, websearch_to_tsquery('english', q),
           'MaxFragments=3, MaxWords=40, MinWords=12, FragmentDelimiter=" … "') as snippet,
         ts_rank(m.search, websearch_to_tsquery('english', q)) as rank
  from meetings m
  where m.search @@ websearch_to_tsquery('english', q)
    and (date_from is null or m.starts_at >= date_from)
    and (date_to is null or m.starts_at <= date_to)
    and (kinds is null or m.kind = any(kinds))
    and (for_client is null or exists (select 1 from meeting_clients mc where mc.meeting_id = m.id and mc.client_id = for_client))
  order by rank desc, m.starts_at desc
  limit lim;
$$;

-- RLS — any signed-in team member (Debbie knows everything, by decision).
alter table meetings enable row level security;
alter table meeting_clients enable row level security;
alter table client_documents enable row level security;
alter table debbie_chats enable row level security;
alter table debbie_messages enable row level security;

drop policy if exists "team can do everything on meetings" on meetings;
create policy "team can do everything on meetings" on meetings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "team can do everything on meeting_clients" on meeting_clients;
create policy "team can do everything on meeting_clients" on meeting_clients
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "team can do everything on client_documents" on client_documents;
create policy "team can do everything on client_documents" on client_documents
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Chats are personal.
drop policy if exists "own debbie chats" on debbie_chats;
create policy "own debbie chats" on debbie_chats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own debbie messages" on debbie_messages;
create policy "own debbie messages" on debbie_messages
  for all using (exists (select 1 from debbie_chats c where c.id = chat_id and c.user_id = auth.uid()))
  with check (exists (select 1 from debbie_chats c where c.id = chat_id and c.user_id = auth.uid()));

notify pgrst, 'reload schema';
