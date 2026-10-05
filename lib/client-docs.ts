// Debbie's client documents: the Client Profile and the Strategy Brief.
// Built from the client's meetings (and every Team Scroll / Boardroom mention
// of them), the work log (every task, its status
// and notes — what the Daily Scroll shows), the discovery notes, the Yellow
// Sheet, the proposal and the previous version. Server-only.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, ClientDocument, Meeting, Task } from "./types";
import { PHASES, packageLabel } from "./flow";
import { loadPackages } from "./packages";
import { yellowSheetText } from "./yellow-sheet";
import type { ProposalData } from "./proposal-template";

export type DocKind = "profile" | "strategy";
export const DOC_TITLES: Record<DocKind, string> = { profile: "Client Profile", strategy: "Strategy Brief" };

const AGENCY = "ClubSheIs, a digital marketing and content production agency in South Africa";
const DEBBIE = "You are Debbie, the ClubSheIs team's memory: you have read every meeting the team has had.";
const RULES = `HOW TO UPDATE:
- If a PREVIOUS VERSION is provided, update it: keep what is still true, replace what has changed, and add what is new. Don't drop useful detail just because this round's inputs don't mention it.
- When sources disagree, the most recent meeting wins. Date decisions and changes, e.g. "(12 Sep call)".
- Never invent facts, numbers, prices or quotes. Where something important is unknown, write [GAP: what to find out].
- Write in plain South African English. Markdown: # for the title, ## for sections, - for bullets. No tables.`;

const PROMPTS: Record<DocKind, string> = {
  profile: `${DEBBIE} You maintain the CLIENT PROFILE for one client of ${AGENCY}. It is the team's reference for who this client is.

Sections:
# Client Profile — [client name]
## Snapshot — business, what they sell, package with us, lead on our side, where we are with them right now (2-4 lines)
## Business and offers — every offer with price and what's included
## Audience — who they serve, their problems and desires, in the client's words where possible
## Brand voice — how they sound, words they use and avoid
## Goals and numbers that matter — revenue, list size, launch dates, targets
## Key people and contacts — names, roles, how they like to be contacted
## History with ClubSheIs — dated timeline: discovery call, proposal, onboarding, meetings, launches, problems
## Preferences and sensitivities — what they love, what frustrates them, things to avoid
## Gaps — what we still need to find out

End with one italic line: "Updated from N meetings (latest: DATE) and the work log up to DATE."

${RULES}`,
  strategy: `${DEBBIE} You maintain the STRATEGY BRIEF for one client of ${AGENCY}. It is a living summary the team reads before a call: short, current and specific. Aim for one to two pages.

Sections:
# Strategy Brief — [client name]
## Where they are now — 3-5 lines on the current state of their business and our work
## Goals for the next 90 days
## What we're doing for them — by workstream, with status from the work log (done, in progress, waiting on the client)
## Decisions made — dated, with the meeting they came from
## What's working and what isn't
## Risks and blockers — including anything waiting on the client
## Open questions for the next call
## Next steps — action, owner, due date

End with one italic line: "Updated from N meetings (latest: DATE) and the work log up to DATE."

${RULES}`,
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "undated";

export async function latestDocs(sb: SupabaseClient, clientId: string) {
  const { data } = await sb.from("client_documents").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20);
  const rows = (data ?? []) as ClientDocument[];
  return { profile: rows.find((r) => r.kind === "profile") ?? null, strategy: rows.find((r) => r.kind === "strategy") ?? null };
}

async function gather(sb: SupabaseClient, clientId: string) {
  await loadPackages(sb);
  const { data: client } = await sb.from("clients").select("*").eq("id", clientId).single();
  if (!client) throw new Error("Client not found.");
  const c = client as Client;
  const [{ data: jobs }, { data: meetings }, { data: profiles }] = await Promise.all([
    sb.from("jobs").select("id, name, kind, stage").eq("client_id", clientId),
    sb.from("meeting_clients").select("meetings(*)").eq("client_id", clientId),
    sb.from("profiles").select("id, name"),
  ]);
  const jobIds = (jobs ?? []).map((j) => j.id);
  const { data: tasks } = jobIds.length ? await sb.from("tasks").select("*").in("job_id", jobIds) : { data: [] };
  const who = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  const jobName = new Map((jobs ?? []).map((j) => [j.id, j.kind === "flow" ? "Client flow" : j.name]));
  const all = (tasks ?? []) as Task[];
  const flow = all.filter((t) => (jobs ?? []).find((j) => j.id === t.job_id)?.kind === "flow");
  const tool = (k: string) => flow.find((t) => t.tool === k)?.tool_state ?? {};

  const parts: string[] = [
    `CLIENT: ${c.name}${c.business_name ? ` (${c.business_name})` : ""}`,
    `PACKAGE: ${packageLabel(c.package)}`,
    [c.email && `Email: ${c.email}`, c.phone && `Phone: ${c.phone}`, c.website_url && `Website: ${c.website_url}`, c.instagram_url && `Instagram: ${c.instagram_url}`]
      .filter(Boolean)
      .join(" · "),
    c.clock_started_on ? `14-DAY BUILD CLOCK STARTED: ${fmtDate(c.clock_started_on)}` : "",
    `TODAY: ${fmtDate(new Date().toISOString())}`,
  ];
  const disc = tool("discovery");
  if (str(disc.need) || str(disc.transcript) || c.call_message)
    parts.push(`=== DISCOVERY CALL ===\nWhat they asked for: ${str(disc.need) || c.call_message || "—"}\nOutcome: ${str(disc.lead) || "—"}\n${str(disc.transcript).slice(0, 12000)}`);
  const ys = yellowSheetText(tool("yellow"));
  if (ys) parts.push(`=== YELLOW SHEET (from the client) ===\n${ys}`);
  const prop = tool("proposal") as { data?: ProposalData; state?: string; sent_at?: string };
  if (prop.data)
    parts.push(
      `=== PROPOSAL (${prop.state === "sent" ? "sent" : "drafted"}) ===\n${prop.data.opportunityParagraphs.join("\n")}\nPricing: ${prop.data.cards.map((x) => `${x.name} ${x.price} ${x.cadence} ${x.totalNote}`).join("; ")}`
    );

  // Their own meetings: most recent first in priority, listed in date order.
  const ms = ((meetings ?? []) as unknown as { meetings: Meeting | null }[])
    .map((r) => r.meetings)
    .filter((m): m is Meeting => !!m && !!m.notes.trim())
    .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""));
  let budget = 90000;
  const kept: Meeting[] = [];
  for (const m of [...ms].reverse()) {
    const cost = Math.min(m.notes.length, 15000);
    if (budget - cost < 0) break;
    budget -= cost;
    kept.unshift(m);
  }
  if (kept.length)
    parts.push(
      `=== MEETING NOTES (${kept.length}${ms.length > kept.length ? ` most recent of ${ms.length}` : ""}) ===\n` +
        kept.map((m) => `--- ${fmtDate(m.starts_at)} · ${m.title || "Meeting"} ---\n${m.notes.slice(0, 15000)}`).join("\n\n")
    );
  else parts.push("=== MEETING NOTES ===\nNone yet.");

  // What the team said about them in Team Scroll, Boardroom and one-on-ones.
  const names = [c.business_name, c.name].filter(Boolean).map((n) => `"${String(n).replace(/"/g, "")}"`).join(" OR ");
  const { data: mentions } = await sb.rpc("search_meetings", {
    q: names,
    kinds: ["team_scroll", "boardroom", "internal", "one_on_one"],
    lim: 15,
  });
  const ownIds = new Set(ms.map((m) => m.id));
  const hits = ((mentions ?? []) as { id: string; title: string; starts_at: string | null; snippet: string }[]).filter((h) => !ownIds.has(h.id));
  if (hits.length)
    parts.push(
      `=== WHAT THE TEAM SAID ABOUT THEM IN INTERNAL MEETINGS (snippets) ===\n` +
        hits
          .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))
          .map((h) => `--- ${fmtDate(h.starts_at)} · ${h.title} ---\n${h.snippet.replace(/<\/?b>/g, "")}`)
          .join("\n\n")
    );

  // Work log, like the Daily Scroll: newest first.
  const log = [...all]
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    .slice(0, 150)
    .map((t) => {
      const phase = PHASES.find((p) => p.id === t.phase)?.label;
      const note = t.notes?.trim() ? ` — notes: ${t.notes.trim().replace(/\s+/g, " ").slice(0, 400)}` : "";
      return `- [${t.status}] ${t.title} (${phase ?? jobName.get(t.job_id) ?? "Task"}; ${who.get(t.assignee_id ?? "") ?? "unassigned"}; due ${t.due_date ?? "—"}; updated ${fmtDate(t.updated_at)})${note}`;
    });
  parts.push(`=== WORK LOG (${all.length} tasks, newest first) ===\n${log.join("\n") || "No tasks yet."}`);

  return { client: c, context: parts.filter(Boolean).join("\n\n"), meetingCount: ms.length, latestMeeting: ms.at(-1)?.starts_at ?? null };
}

async function write(anthropic: Anthropic, kind: DocKind, context: string, previous: string | null) {
  const stream = anthropic.beta.messages.stream({
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: PROMPTS[kind],
    messages: [{ role: "user", content: `${context}\n\n=== PREVIOUS VERSION ===\n${previous?.slice(0, 30000) || "None — write the first version."}` }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error(`Claude declined to write the ${DOC_TITLES[kind]}.`);
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  if (!text) throw new Error(`The ${DOC_TITLES[kind]} came back empty.`);
  return text;
}

/** Write fresh versions of both documents and clear the "needs update" flag. */
/** `trigger` names what prompted this update, e.g. "their Yellow Sheet", for the version note. */
export async function updateClientDocs(sb: SupabaseClient, clientId: string, trigger?: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY isn't set on the Tracker.");
  const started = new Date().toISOString();
  const [{ context, meetingCount, latestMeeting }, prev] = await Promise.all([gather(sb, clientId), latestDocs(sb, clientId)]);
  const anthropic = new Anthropic();
  const [profile, strategy] = await Promise.all([
    write(anthropic, "profile", context, prev.profile?.content ?? null),
    write(anthropic, "strategy", context, prev.strategy?.content ?? null),
  ]);
  const sources = `${trigger ? `${trigger}, ` : ""}${meetingCount} meeting${meetingCount === 1 ? "" : "s"}${latestMeeting ? ` (latest ${fmtDate(latestMeeting)})` : ""}, team mentions and the work log`;
  const { error } = await sb.from("client_documents").insert([
    { client_id: clientId, kind: "profile", content: profile, sources },
    { client_id: clientId, kind: "strategy", content: strategy, sources },
  ]);
  if (error) throw new Error(error.message);
  // Only clear the flag if nothing new arrived while we were writing.
  await sb.from("clients").update({ docs_dirty_at: null }).eq("id", clientId).or(`docs_dirty_at.is.null,docs_dirty_at.lte.${started}`);
}

/** Work through clients whose meeting notes changed (a few per run). */
export async function processDirtyClients(sb: SupabaseClient, limit = 2) {
  const settled = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // let a burst of notes settle first
  const { data } = await sb
    .from("clients")
    .select("id")
    .not("docs_dirty_at", "is", null)
    .lte("docs_dirty_at", settled)
    .order("docs_dirty_at", { ascending: true })
    .limit(limit);
  const done: string[] = [];
  for (const row of data ?? []) {
    try {
      await updateClientDocs(sb, row.id);
      done.push(row.id);
    } catch {
      // Leave it flagged but try again in an hour, not every run.
      await sb.from("clients").update({ docs_dirty_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }).eq("id", row.id);
    }
  }
  return done;
}
