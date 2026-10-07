// The business dashboard: sales target, pipeline and forecast, revenue (from
// proposal prices), the team's week, wins and bottlenecks. Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Job, Profile, Task } from "./types";
import { isDone } from "./flow";
import { withoutArchived } from "./archived";

const DAY = 864e5;
const RECENT_DAYS = 14;

export type Targets = { newClientsPerMonth: number };

export async function loadTargets(sb: SupabaseClient): Promise<Targets> {
  const { data } = await sb.from("app_settings").select("value").eq("key", "targets").maybeSingle();
  const v = (data?.value ?? {}) as Partial<Targets>;
  return { newClientsPerMonth: v.newClientsPerMonth && v.newClientsPerMonth > 0 ? v.newClientsPerMonth : 10 };
}

/** When a client became a paying client: Ghutte paid, or (for older clients) their 14-day clock started. */
export const paidAt = (c: Client) => c.ghutte_paid_at ?? (c.clock_started_on ? `${c.clock_started_on}T09:00:00+02:00` : null);

type Card = { name: string; price: string; cadence: string };
type ProposalState = { data?: { cards?: Card[] }; sent_at?: string };

/** "R7,600" → 7600; "from R2 500" → 2500. */
export function rands(price: string) {
  const n = Number(String(price).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
const isMonthly = (cadence: string) => /month|mo\b|pm\b|recurring/i.test(cadence);

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d: Date) => d.toLocaleDateString("en-ZA", { month: "short" });

export type Win = { at: string; kind: "paid" | "accepted" | "proposal" | "yellow" | "published" | "flow"; text: string; clientId?: string };
export type Person = {
  id: string;
  name: string;
  avatar_url: string | null;
  doneWeek: number;
  onTime: number | null;
  streak: number;
  open: number;
  overdue: number;
};

export async function loadDashboard(sb: SupabaseClient) {
  const [{ data: clientRows }, { data: taskRows }, { data: jobRows }, { data: profileRows }, targets] = await Promise.all([
    sb.from("clients").select("*"),
    sb.from("tasks").select("id, job_id, title, status, assignee_id, due_date, updated_at, created_at, phase, tool, tool_state"),
    sb.from("jobs").select("id, client_id, kind, name, stage"),
    sb.from("profiles").select("*").order("name"),
    loadTargets(sb),
  ]);
  const clients = (clientRows ?? []) as Client[];
  const jobs = (jobRows ?? []) as Job[];
  // Archived clients' (Past leads') tasks don't count towards workload or bottlenecks.
  const tasks = withoutArchived((taskRows ?? []) as Task[], jobs, clients);
  const profiles = (profileRows ?? []) as Profile[];

  const now = new Date();
  const nowMs = now.getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysInMonth = Math.round((nextMonth.getTime() - monthStart.getTime()) / DAY);
  const dayOfMonth = now.getDate();
  const inMonth = (iso: string | null | undefined) => !!iso && new Date(iso) >= monthStart && new Date(iso) < nextMonth;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
  const today = now.toISOString().slice(0, 10);

  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const clientOf = (t: Task) => clientById.get(jobById.get(t.job_id)?.client_id ?? "");
  const tasksByClient = new Map<string, Task[]>();
  for (const t of tasks) {
    const cid = jobById.get(t.job_id)?.client_id;
    if (!cid) continue;
    (tasksByClient.get(cid) ?? tasksByClient.set(cid, []).get(cid)!).push(t);
  }
  const proposalOf = (cid: string) =>
    (tasksByClient.get(cid) ?? []).find((t) => t.tool === "proposal")?.tool_state as ProposalState | undefined;
  const cardsOf = (cid: string) => proposalOf(cid)?.data?.cards ?? [];

  // ── Sales target ──────────────────────────────────────────────────────
  const paying = clients.filter((c) => paidAt(c));
  const newThisMonth = paying.filter((c) => inMonth(paidAt(c))).sort((a, b) => (paidAt(b) ?? "").localeCompare(paidAt(a) ?? ""));
  const target = targets.newClientsPerMonth;
  const expectedByNow = (target * dayOfMonth) / daysInMonth;

  const history = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = monthKey(d);
    return { key, label: monthLabel(d), count: paying.filter((c) => monthKey(new Date(paidAt(c)!)) === key).length, current: i === 5 };
  });

  // ── Pipeline and conversion (last 90 days, with sensible fallbacks) ─────
  const ago = (days: number) => nowMs - days * DAY;
  const rate = (hits: number, total: number, fallback: number, minSample = 5) => (total >= minSample ? hits / total : fallback);

  const callsWindow = clients.filter((c) => c.call_at && !c.call_cancelled && new Date(c.call_at).getTime() < ago(21) && new Date(c.call_at).getTime() > ago(120));
  const callToPaid = rate(callsWindow.filter((c) => paidAt(c)).length, callsWindow.length, 0.15);

  const sentAt = (c: Client) => proposalOf(c.id)?.sent_at ?? null;
  const sentWindow = clients.filter((c) => {
    const s = sentAt(c);
    return s && new Date(s).getTime() < ago(14) && new Date(s).getTime() > ago(120);
  });
  const sentToPaid = rate(sentWindow.filter((c) => paidAt(c)).length, sentWindow.length, 0.35);
  const acceptedWindow = clients.filter((c) => c.proposal_accepted_at && new Date(c.proposal_accepted_at).getTime() < ago(7));
  const acceptedToPaid = rate(acceptedWindow.filter((c) => paidAt(c)).length, acceptedWindow.length, 0.85, 3);

  const callsThisMonth = clients.filter((c) => inMonth(c.call_at) && !c.call_cancelled);
  const callsHeld = callsThisMonth.filter((c) => new Date(c.call_at!).getTime() <= nowMs);
  const callsUpcoming = callsThisMonth.filter((c) => new Date(c.call_at!).getTime() > nowMs);
  const proposalsSentThisMonth = clients.filter((c) => inMonth(sentAt(c)));
  const acceptedThisMonth = clients.filter((c) => inMonth(c.proposal_accepted_at));

  // Open deals: accepted but unpaid; proposals sent in the last 30 days, not yet accepted or paid.
  const acceptedUnpaid = clients.filter((c) => c.proposal_accepted_at && !paidAt(c) && !c.is_past_lead);
  const openProposals = clients.filter((c) => {
    const s = sentAt(c);
    return s && new Date(s).getTime() > ago(30) && !c.proposal_accepted_at && !paidAt(c) && !c.is_past_lead;
  });
  // Calls still to come convert later, so only part of their chance lands this month.
  const forecast =
    newThisMonth.length +
    acceptedUnpaid.length * acceptedToPaid +
    openProposals.length * sentToPaid +
    callsUpcoming.length * callToPaid * 0.5;
  const needed = Math.max(0, target - newThisMonth.length);

  const chase = [
    ...acceptedUnpaid.map((c) => ({ client: c, why: "Accepted, not paid yet", since: c.proposal_accepted_at! })),
    ...openProposals
      .filter((c) => new Date(sentAt(c)!).getTime() < ago(4))
      .map((c) => ({ client: c, why: "Proposal sent, no answer", since: sentAt(c)! })),
  ].sort((a, b) => a.since.localeCompare(b.since));

  // ── Revenue, from proposal prices ───────────────────────────────────────
  const money = (cs: Client[], monthly: boolean) =>
    cs.reduce((sum, c) => sum + cardsOf(c.id).filter((k) => isMonthly(k.cadence) === monthly).reduce((s, k) => s + rands(k.price), 0), 0);
  const activePaying = paying.filter((c) => !c.is_past_lead);
  const revenue = {
    onceOffThisMonth: money(newThisMonth, false),
    newMrrThisMonth: money(newThisMonth, true),
    mrr: money(activePaying, true),
    pipelineOnceOff: money([...acceptedUnpaid, ...openProposals], false),
    pipelineMonthly: money([...acceptedUnpaid, ...openProposals], true),
    weightedPipeline: money(acceptedUnpaid, false) * acceptedToPaid + money(openProposals, false) * sentToPaid,
    priced: activePaying.filter((c) => cardsOf(c.id).length).length,
    unpriced: activePaying.filter((c) => !cardsOf(c.id).length).length,
  };
  const forecastMonthIncome = revenue.onceOffThisMonth + revenue.mrr + revenue.weightedPipeline;

  // ── The team's week ────────────────────────────────────────────────────
  const open = tasks.filter((t) => !isDone(t));
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const doneRecently = tasks.filter((t) => isDone(t) && new Date(t.updated_at).getTime() > ago(21));
  const workdays = (n: number) => {
    // Consecutive weekdays (back from today) with at least one task finished.
    const days = new Set(doneRecently.filter((t) => t.assignee_id).map((t) => `${t.assignee_id}|${t.updated_at.slice(0, 10)}`));
    return (id: string) => {
      let streak = 0;
      const d = new Date(now);
      for (let i = 0; i < n; i++) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) {
          if (days.has(`${id}|${d.toISOString().slice(0, 10)}`)) streak++;
          else if (i > 0) break; // today can still be empty
        }
        d.setDate(d.getDate() - 1);
      }
      return streak;
    };
  };
  const streakOf = workdays(21);
  const people: Person[] = profiles
    .map((p) => {
      const mine = tasks.filter((t) => t.assignee_id === p.id);
      const doneWeek = mine.filter((t) => isDone(t) && new Date(t.updated_at) >= weekStart);
      const dated = doneWeek.filter((t) => t.due_date);
      return {
        id: p.id,
        name: p.name,
        avatar_url: p.avatar_url ?? null,
        doneWeek: doneWeek.length,
        onTime: dated.length ? dated.filter((t) => t.updated_at.slice(0, 10) <= t.due_date!).length / dated.length : null,
        streak: streakOf(p.id),
        open: mine.filter((t) => !isDone(t)).length,
        overdue: mine.filter((t) => !isDone(t) && t.due_date && t.due_date < today).length,
      };
    })
    .filter((p) => p.doneWeek || p.open)
    .sort((a, b) => b.doneWeek - a.doneWeek || (b.onTime ?? 0) - (a.onTime ?? 0));
  const teamDoneWeek = people.reduce((s, p) => s + p.doneWeek, 0);
  const teamDoneLastWeek = tasks.filter(
    (t) => isDone(t) && new Date(t.updated_at) >= new Date(weekStart.getTime() - 7 * DAY) && new Date(t.updated_at) < weekStart
  ).length;

  // ── Wins ───────────────────────────────────────────────────────────────
  const since = ago(RECENT_DAYS);
  const recent = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() > since;
  const first = (c: Client) => c.business_name || c.name;
  const wins: Win[] = [];
  for (const c of clients) {
    if (recent(c.ghutte_paid_at)) wins.push({ at: c.ghutte_paid_at!, kind: "paid", text: `${first(c)} paid for Ghutte`, clientId: c.id });
    if (recent(c.proposal_accepted_at)) wins.push({ at: c.proposal_accepted_at!, kind: "accepted", text: `${first(c)} accepted their proposal`, clientId: c.id });
    if (recent(sentAt(c))) wins.push({ at: sentAt(c)!, kind: "proposal", text: `Proposal sent to ${first(c)}`, clientId: c.id });
    const ys = (tasksByClient.get(c.id) ?? []).find((t) => t.tool === "yellow")?.tool_state as { submitted_at?: string } | undefined;
    if (recent(ys?.submitted_at)) wins.push({ at: ys!.submitted_at!, kind: "yellow", text: `${first(c)} sent their Yellow Sheet`, clientId: c.id });
    const flow = (tasksByClient.get(c.id) ?? []).filter((t) => t.phase);
    if (flow.length && flow.every(isDone)) {
      const last = flow.reduce((m, t) => (t.updated_at > m ? t.updated_at : m), "");
      if (recent(last)) wins.push({ at: last, kind: "flow", text: `${first(c)}'s client flow is complete`, clientId: c.id });
    }
  }
  for (const t of tasks) {
    if (t.status === "published" && recent(t.updated_at)) {
      const c = clientOf(t);
      wins.push({ at: t.updated_at, kind: "published", text: `Published: ${t.title}${c ? ` (${first(c)})` : ""}`, clientId: c?.id });
    }
  }
  wins.sort((a, b) => b.at.localeCompare(a.at));

  // ── Bottlenecks ────────────────────────────────────────────────────────
  const byClientOverdue = new Map<string, number>();
  for (const t of overdue) {
    const c = clientOf(t);
    if (c) byClientOverdue.set(c.id, (byClientOverdue.get(c.id) ?? 0) + 1);
  }
  const waitingOnClients = open
    .filter((t) => t.status === "awaiting_client" && new Date(t.updated_at).getTime() < ago(5))
    .map((t) => ({ task: t, client: clientOf(t), days: Math.floor((nowMs - new Date(t.updated_at).getTime()) / DAY) }))
    .sort((a, b) => b.days - a.days);
  const stuckClients = clients
    .filter((c) => !c.is_past_lead)
    .map((c) => {
      const flow = (tasksByClient.get(c.id) ?? []).filter((t) => t.phase);
      if (!flow.length || flow.every(isDone)) return null;
      const last = flow.reduce((m, t) => (t.updated_at > m ? t.updated_at : m), "");
      const days = Math.floor((nowMs - new Date(last).getTime()) / DAY);
      return days >= 14 && c.package !== "lead" ? { client: c, days } : null;
    })
    .filter((x): x is { client: Client; days: number } => !!x)
    .sort((a, b) => b.days - a.days);

  return {
    now: now.toISOString(),
    month: now.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
    dayOfMonth,
    daysInMonth,
    target,
    expectedByNow,
    newThisMonth,
    history,
    needed,
    forecast,
    rates: { callToPaid, sentToPaid, acceptedToPaid },
    funnel: {
      callsHeld: callsHeld.length,
      callsUpcoming: callsUpcoming.length,
      proposalsSent: proposalsSentThisMonth.length,
      accepted: acceptedThisMonth.length,
      paid: newThisMonth.length,
    },
    chase,
    revenue,
    forecastMonthIncome,
    people,
    teamDoneWeek,
    teamDoneLastWeek,
    wins: wins.slice(0, 15),
    bottlenecks: {
      overdue: overdue.length,
      unassigned: open.filter((t) => !t.assignee_id).length,
      overdueByClient: [...byClientOverdue.entries()]
        .map(([id, n]) => ({ client: clientById.get(id)!, n }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 5),
      waitingOnClients: waitingOnClients.slice(0, 6),
      stuckClients: stuckClients.slice(0, 6),
    },
    glance: {
      activeClients: clients.filter((c) => !c.is_past_lead).length,
      openTasks: open.length,
    },
  };
}

export type Dashboard = Awaited<ReturnType<typeof loadDashboard>>;

/** Plain-text facts for Debbie's weekly briefing (no money: the whole team reads it). */
export function briefingFacts(d: Dashboard) {
  const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);
  return [
    `Month: ${d.month}, day ${d.dayOfMonth} of ${d.daysInMonth}.`,
    `New paying clients this month: ${d.newThisMonth.length} of a ${d.target} target (pace says ${d.expectedByNow.toFixed(1)} by now). Forecast for month end: about ${Math.round(d.forecast)}.`,
    `New clients this month: ${d.newThisMonth.map((c) => c.business_name || c.name).join(", ") || "none yet"}.`,
    `Pipeline this month: ${d.funnel.callsHeld} discovery calls held, ${d.funnel.callsUpcoming} still booked, ${d.funnel.proposalsSent} proposals sent, ${d.funnel.accepted} accepted, ${d.funnel.paid} paid.`,
    `Deals to chase: ${d.chase.map((x) => `${x.client.business_name || x.client.name} (${x.why.toLowerCase()})`).join("; ") || "none"}.`,
    `Team this week: ${d.teamDoneWeek} tasks finished (last week ${d.teamDoneLastWeek}). By person: ${d.people
      .map((p) => `${p.name} ${p.doneWeek} done, on time ${pct(p.onTime)}, ${p.overdue} overdue, streak ${p.streak} days`)
      .join("; ")}.`,
    `Wins in the last two weeks: ${d.wins.map((w) => w.text).join("; ") || "none recorded"}.`,
    `Bottlenecks: ${d.bottlenecks.overdue} overdue tasks, ${d.bottlenecks.unassigned} unassigned. Waiting on clients 5+ days: ${
      d.bottlenecks.waitingOnClients.map((w) => `${w.task.title} (${w.client?.name ?? "?"}, ${w.days} days)`).join("; ") || "none"
    }. Clients with no progress for 14+ days: ${d.bottlenecks.stuckClients.map((s) => `${s.client.name} (${s.days} days)`).join("; ") || "none"}.`,
  ].join("\n");
}
