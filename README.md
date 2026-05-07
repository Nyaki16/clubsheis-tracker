# ClubSheIs Production Tracker

A focused, fast project management tool for the ClubSheIs team. Built with Next.js 16 (App Router) + Supabase.

## Pages

- `/daily` — **Daily Scroll**: every task grouped by who owns it, with inline status updates and filters
- `/dashboard` — Overview stats and stuck-review alerts
- `/clients` → `/clients/[id]` → `/clients/[id]/jobs/[jobId]` — Client and job drill-down
- `/pipeline` — Kanban view of all jobs by stage
- `/team` — Per-member task lists

## Stack

- Next.js 16 (App Router, React Server Components, Server Actions)
- Supabase (Postgres + magic-link auth)
- Tailwind CSS v4
- lucide-react

## Setup

### 1. Create a Supabase project

1. Go to https://supabase.com/dashboard, create a new project.
2. Project Settings → API → copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Configure env vars

```bash
cp .env.local.example .env.local
# Then edit .env.local and paste in your URL and anon key
```

### 3. Run the SQL migration

Open the Supabase SQL editor and run the contents of `supabase/migrations/0001_init.sql`. This creates:

- `profiles` (auto-populated when a user signs in for the first time, via a trigger on `auth.users`)
- `clients`, `jobs`, `tasks`, `deliverables`
- Row Level Security: any authenticated user can read/write
- 4 sample clients (Palesa Dooms, Motshabi, Sibu Sibaca, Link Interiors)

### 4. Configure auth (lock down signups)

In the Supabase dashboard:

1. **Authentication → Providers → Email**: enable Email, leave **Confirm email** on (this enables magic-link OTP).
2. **Authentication → Sign in / Up**: turn **off** "Allow new users to sign up" so randoms can't create accounts.
3. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` for dev, `https://your-app.vercel.app` for prod
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` and `https://your-app.vercel.app/auth/callback`
4. **Authentication → Users → Invite user** for each team member (Nyaki, Kopano, Gizelle, Xolisile, Okuhle). They'll get an email; their profile row is auto-created when they first sign in.

### 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the repo on Vercel.
3. Set the same two env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in Project Settings → Environment Variables.
4. Add your Vercel URL to Supabase **URL Configuration** (Site URL + Redirect URL with `/auth/callback`).
5. Deploy.

## Architecture notes

- **Server Components** fetch data from Supabase via the SSR cookie-bound client (`lib/supabase/server.ts`).
- **Server Actions** in `app/actions/*` handle all mutations and call `revalidatePath()` afterward.
- **Client islands** (e.g. status dropdowns, modals) wrap interactive pieces with `useTransition` for instant feedback.
- **`proxy.ts`** (Next.js 16 rename of `middleware.ts`) refreshes the Supabase session on every request and gates non-public routes to authenticated users.
- **Auth model**: open magic-link sign-in for any email already invited via the Supabase dashboard. The `profiles` row is auto-created from `auth.users` on first sign-in via a Postgres trigger.

## File map

```
app/
  layout.tsx                          root html
  page.tsx                            redirects to /daily
  globals.css                         Tailwind v4 entrypoint
  login/                              magic-link sign in
  auth/callback/route.ts              OTP exchange handler
  (app)/                              route group; layout enforces auth
    layout.tsx                        nav + auth gate
    daily/                            Daily Scroll
    dashboard/
    clients/
      page.tsx                        list
      [id]/page.tsx                   client detail
      [id]/jobs/[jobId]/page.tsx      job detail
    pipeline/
    team/
  actions/                            server actions for all mutations
components/                           nav, modal, shared forms
lib/
  supabase/{server,client,middleware}.ts
  constants.ts types.ts utils.ts
proxy.ts                              session refresh + route gating
supabase/migrations/0001_init.sql
```
