// Debbie: the team's memory. She has every meeting (Team Scroll, Boardroom,
// client calls, one-on-ones), every task and every client, and answers from
// them with tools. She also recommends tasks that a Team Scroll discussed but
// nobody captured. Server-only.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PHASES, isDone, packageLabel, currentPhase } from "./flow";
import type { Meeting, Task } from "./types";

export const DEBBIE_MODEL = "claude-sonnet-5-5";
const MAX_TOOL_ROUNDS = 10;

const KINDS = ["team_scroll", "boardroom", "client", "discovery", "one_on_one", "internal", "other"] as const;
const KIND_LABEL: Record<string, string> = {
  team_scroll: "Team Scroll",
  boardroom: "Boardroom",
  client: "Client meeting",
  discovery: "Discovery call",
  one_on_one: "One-on-one",
  internal: "Internal meeting",
  other: "Meeting",
};
const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "undated";
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}… [cut]` : s);

type Row = Record<string, unknown>;

// ── Tools ────────────────────────────────────────────────────────────────────

export const DEBBIE_TOOLS = [
  {
    name: "search_meetings",
    description:
      "Full-text search across the notes of every meeting the team has had (Team Scroll, Boardroom, client calls, discovery calls, one-on-ones). Returns the best matches with highlighted snippets. Use several searches with different wording when the first finds little. Use read_meeting to read a match in full before quoting it.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to find. Supports quotes for phrases and OR, e.g. \"price increase\" OR pricing." },
        from: { type: "string", description: "Optional start date, YYYY-MM-DD." },
        to: { type: "string", description: "Optional end date, YYYY-MM-DD." },
        kind: { type: "string", enum: [...KINDS], description: "Optional meeting type." },
        client: { type: "string", description: "Optional client or business name, to search only meetings with that client." },
      },
      required: ["query"],
    },
  },
  {
    name: "read_meeting",
    description: "Read one meeting in full: title, date, type, attendees, linked clients and the complete notes.",
    input_schema: { type: "object", properties: { meeting_id: { type: "string" } }, required: ["meeting_id"] },
  },
  {
    name: "list_meetings",
    description: "List meetings in a date range (newest first), optionally by type or client. Use for questions like 'what did we cover in yesterday's Team Scroll' or 'when did we last meet X'.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
        kind: { type: "string", enum: [...KINDS] },
        client: { type: "string" },
        limit: { type: "number", description: "Default 15, max 40." },
      },
    },
  },
  {
    name: "find_client",
    description: "Find clients by name, business, email or phone. Returns package, phase, lead, contact details and whether they are a past lead.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "client_status",
    description: "A client's current status: every task in their client flow with status, owner and due date, their other jobs, and their latest Strategy Brief.",
    input_schema: { type: "object", properties: { client: { type: "string", description: "Client or business name." } }, required: ["client"] },
  },
  {
    name: "search_tasks",
    description:
      "Search the work log (what the Daily Scroll shows): tasks across every client with status, owner, due date and notes. Filter by words, person, client, status, overdue, or Debbie Recommends tasks.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words in the task title or notes." },
        assignee: { type: "string", description: "Team member's name." },
        client: { type: "string" },
        status: {
          type: "string",
          enum: ["planning", "in_progress", "in_review", "internally_reviewed", "awaiting_client", "published", "closed_out", "open"],
          description: "'open' means anything not published or closed out.",
        },
        overdue: { type: "boolean" },
        debbie_recommended: { type: "boolean" },
        limit: { type: "number", description: "Default 40, max 100." },
      },
    },
  },
  {
    name: "add_task",
    description:
      "Add a task, marked Debbie Recommends. ONLY use this when the person you're talking to explicitly asks you to add or create a task. Confirm the details in your reply.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        client: { type: "string", description: "Client or business name; leave out for internal team tasks." },
        assignee: { type: "string", description: "Team member's name." },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        notes: { type: "string" },
      },
      required: ["title"],
    },
  },
];

// A value for a PostgREST or() filter, quoted so spaces and commas are safe.
const like = (v: string) => `"%${v.replace(/["\\%]/g, " ").trim()}%"`;

async function resolveClient(sb: SupabaseClient, name: string) {
  const q = name.trim();
  if (!q) return null;
  const { data } = await sb
    .from("clients")
    .select("id, name, business_name, email, phone, package, lead_id, is_past_lead, call_at")
    .or(`name.ilike.${like(q)},business_name.ilike.${like(q)},email.ilike.${like(q)}`)
    .order("is_past_lead", { ascending: true })
    .limit(8);
  return (data ?? []) as Row[];
}

async function profiles(sb: SupabaseClient) {
  const { data } = await sb.from("profiles").select("id, name, job_title, email");
  return (data ?? []) as { id: string; name: string; job_title: string | null; email: string }[];
}

// Where a Debbie task goes: a client's flow (in their current phase, so it
// shows on Home and the client page), or the internal "Team tasks" job.
async function taskHome(sb: SupabaseClient, clientId: string | null): Promise<{ jobId: string; phase: string | null }> {
  if (clientId) {
    const { data: flow } = await sb.from("jobs").select("id").eq("client_id", clientId).eq("kind", "flow").maybeSingle();
    if (flow) {
      const { data: ts } = await sb.from("tasks").select("phase, status, position, created_at").eq("job_id", flow.id);
      return { jobId: flow.id as string, phase: currentPhase((ts ?? []) as Task[]) ?? "sales" };
    }
    const { data: job } = await sb.from("jobs").select("id").eq("client_id", clientId).eq("name", "Debbie Recommends").maybeSingle();
    if (job) return { jobId: job.id as string, phase: null };
    const { data: made } = await sb.from("jobs").insert({ client_id: clientId, name: "Debbie Recommends", kind: "job", stage: "briefing" }).select("id").single();
    return { jobId: made!.id as string, phase: null };
  }
  let { data: internal } = await sb.from("clients").select("id").ilike("name", "CSI Internal").limit(1).maybeSingle();
  if (!internal) internal = (await sb.from("clients").insert({ name: "CSI Internal", color: "#64748B" }).select("id").single()).data;
  const { data: job } = await sb.from("jobs").select("id").eq("client_id", internal!.id).eq("name", "Team tasks").maybeSingle();
  if (job) return { jobId: job.id as string, phase: null };
  const { data: made } = await sb.from("jobs").insert({ client_id: internal!.id, name: "Team tasks", kind: "job", stage: "briefing" }).select("id").single();
  return { jobId: made!.id as string, phase: null };
}

export async function createDebbieTask(
  sb: SupabaseClient,
  t: { title: string; client?: string; assignee?: string; due_date?: string; notes?: string },
  source: { meeting_id: string | null; meeting_title: string; date: string | null; quote: string }
) {
  const people = await profiles(sb);
  const who = t.assignee ? people.find((p) => p.name.toLowerCase().startsWith(t.assignee!.toLowerCase().split(" ")[0])) : undefined;
  const matches = t.client ? await resolveClient(sb, t.client) : null;
  const client = matches?.[0] ?? null;
  const home = await taskHome(sb, (client?.id as string) ?? null);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(t.due_date ?? "") ? t.due_date : new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("tasks")
    .insert({
      job_id: home.jobId,
      phase: home.phase,
      position: home.phase ? 900 : null,
      title: t.title.trim(),
      notes: t.notes?.trim() ?? "",
      status: "planning",
      assignee_id: who?.id ?? (client?.lead_id as string | null) ?? null,
      due_date: due,
      debbie_recommended: true,
      debbie_source: source,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, client: (client?.name as string) ?? "Internal", assignee: who?.name ?? "Unassigned", due };
}

export async function runTool(sb: SupabaseClient, name: string, input: Row, ctx: { userName: string }): Promise<string> {
  const s = (k: string) => (typeof input[k] === "string" ? (input[k] as string).trim() : "");
  switch (name) {
    case "search_meetings": {
      let clientId: string | null = null;
      if (s("client")) {
        const c = await resolveClient(sb, s("client"));
        clientId = (c?.[0]?.id as string) ?? null;
        if (!clientId) return `No client matches "${s("client")}".`;
      }
      const { data, error } = await sb.rpc("search_meetings", {
        q: s("query"),
        date_from: s("from") || null,
        date_to: s("to") ? `${s("to")}T23:59:59+02:00` : null,
        kinds: s("kind") ? [s("kind")] : null,
        for_client: clientId,
        lim: 12,
      });
      if (error) return `Search failed: ${error.message}`;
      const rows = (data ?? []) as { id: string; title: string; starts_at: string; kind: string; snippet: string }[];
      if (!rows.length) return "No meetings match. Try other words, a wider date range, or list_meetings.";
      return rows
        .map((r) => `[${r.id}] ${fmt(r.starts_at)} · ${KIND_LABEL[r.kind] ?? r.kind} · ${r.title}\n  ${r.snippet.replace(/<\/?b>/g, "**")}`)
        .join("\n");
    }
    case "read_meeting": {
      const { data: m } = await sb.from("meetings").select("*").eq("id", s("meeting_id")).maybeSingle();
      if (!m) return "No meeting with that id.";
      const mt = m as Meeting;
      const { data: links } = await sb.from("meeting_clients").select("clients(name, business_name)").eq("meeting_id", mt.id);
      const clients = ((links ?? []) as unknown as { clients: { name: string; business_name: string | null } | null }[])
        .map((l) => l.clients && (l.clients.business_name ? `${l.clients.name} (${l.clients.business_name})` : l.clients.name))
        .filter(Boolean);
      return [
        `${mt.title} · ${KIND_LABEL[mt.kind]} · ${fmt(mt.starts_at)}`,
        `Attendees: ${mt.attendees.map((a) => a.name || a.email).join(", ") || "—"}`,
        clients.length ? `Clients: ${clients.join(", ")}` : "",
        mt.notes_url ? `Notes doc: ${mt.notes_url}` : "",
        `\n${clip(mt.notes || "(no notes)", 40000)}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "list_meetings": {
      let q = sb.from("meetings").select("id, title, starts_at, kind, notes").order("starts_at", { ascending: false }).limit(Math.min(Number(input.limit) || 15, 40));
      if (s("from")) q = q.gte("starts_at", s("from"));
      if (s("to")) q = q.lte("starts_at", `${s("to")}T23:59:59+02:00`);
      if (s("kind")) q = q.eq("kind", s("kind"));
      if (s("client")) {
        const c = await resolveClient(sb, s("client"));
        if (!c?.length) return `No client matches "${s("client")}".`;
        const { data: links } = await sb.from("meeting_clients").select("meeting_id").eq("client_id", c[0].id as string);
        q = q.in("id", (links ?? []).map((l) => l.meeting_id));
      }
      const { data } = await q;
      const rows = (data ?? []) as { id: string; title: string; starts_at: string; kind: string; notes: string }[];
      return rows.length
        ? rows.map((r) => `[${r.id}] ${fmt(r.starts_at)} · ${KIND_LABEL[r.kind]} · ${r.title}${r.notes.trim() ? "" : " (no notes)"}`).join("\n")
        : "No meetings in that range.";
    }
    case "find_client": {
      const rows = await resolveClient(sb, s("query"));
      if (!rows?.length) return `No client matches "${s("query")}".`;
      const people = await profiles(sb);
      return rows
        .map(
          (c) =>
            `${c.name}${c.business_name ? ` (${c.business_name})` : ""} · ${packageLabel(c.package as string)} · lead ${people.find((p) => p.id === c.lead_id)?.name ?? "—"}${c.is_past_lead ? " · past lead" : ""}${c.email ? ` · ${c.email}` : ""}${c.phone ? ` · ${c.phone}` : ""}${c.call_at ? ` · discovery call ${fmt(c.call_at as string)}` : ""}`
        )
        .join("\n");
    }
    case "client_status": {
      const rows = await resolveClient(sb, s("client"));
      if (!rows?.length) return `No client matches "${s("client")}".`;
      const c = rows[0];
      const [{ data: jobs }, people, { data: brief }] = await Promise.all([
        sb.from("jobs").select("id, name, kind, stage").eq("client_id", c.id as string),
        profiles(sb),
        sb.from("client_documents").select("content, created_at").eq("client_id", c.id as string).eq("kind", "strategy").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const ids = (jobs ?? []).map((j) => j.id);
      const { data: tasks } = ids.length ? await sb.from("tasks").select("*").in("job_id", ids) : { data: [] };
      const flowJob = (jobs ?? []).find((j) => j.kind === "flow");
      const flow = ((tasks ?? []) as Task[]).filter((t) => t.job_id === flowJob?.id);
      const other = ((tasks ?? []) as Task[]).filter((t) => t.job_id !== flowJob?.id);
      const line = (t: Task) =>
        `- [${t.status}] ${t.title} · ${people.find((p) => p.id === t.assignee_id)?.name ?? "unassigned"} · due ${t.due_date ?? "—"}${t.debbie_recommended ? " · Debbie Recommends" : ""}`;
      const phase = currentPhase(flow);
      return [
        `${c.name}${c.business_name ? ` (${c.business_name})` : ""} · ${packageLabel(c.package as string)} · now in ${PHASES.find((p) => p.id === phase)?.label ?? "—"} · ${flow.filter(isDone).length}/${flow.length} flow tasks done`,
        flow.length ? `CLIENT FLOW:\n${flow.map(line).join("\n")}` : "No client flow yet.",
        other.length ? `OTHER JOBS:\n${other.slice(0, 40).map((t) => `${line(t)} (${(jobs ?? []).find((j) => j.id === t.job_id)?.name})`).join("\n")}` : "",
        brief ? `LATEST STRATEGY BRIEF (${fmt(brief.created_at)}):\n${clip(brief.content, 8000)}` : "No Strategy Brief yet.",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    case "search_tasks": {
      const people = await profiles(sb);
      let q = sb.from("tasks").select("id, title, status, due_date, notes, assignee_id, job_id, debbie_recommended, updated_at").order("updated_at", { ascending: false }).limit(Math.min(Number(input.limit) || 40, 100));
      if (s("query")) q = q.or(`title.ilike.${like(s("query"))},notes.ilike.${like(s("query"))}`);
      if (s("assignee")) {
        const p = people.find((x) => x.name.toLowerCase().startsWith(s("assignee").toLowerCase().split(" ")[0]));
        if (!p) return `No team member called "${s("assignee")}".`;
        q = q.eq("assignee_id", p.id);
      }
      if (s("status") === "open") q = q.not("status", "in", "(published,closed_out)");
      else if (s("status")) q = q.eq("status", s("status"));
      if (input.overdue === true) q = q.lt("due_date", new Date().toISOString().slice(0, 10)).not("status", "in", "(published,closed_out)");
      if (input.debbie_recommended === true) q = q.eq("debbie_recommended", true);
      if (s("client")) {
        const c = await resolveClient(sb, s("client"));
        if (!c?.length) return `No client matches "${s("client")}".`;
        const { data: jobs } = await sb.from("jobs").select("id").eq("client_id", c[0].id as string);
        q = q.in("job_id", (jobs ?? []).map((j) => j.id));
      }
      const { data } = await q;
      const rows = (data ?? []) as Task[];
      if (!rows.length) return "No tasks match.";
      const { data: jobs } = await sb.from("jobs").select("id, name, kind, clients(name)").in("id", [...new Set(rows.map((r) => r.job_id))]);
      const jobInfo = new Map(((jobs ?? []) as unknown as { id: string; name: string; kind: string; clients: { name: string } | null }[]).map((j) => [j.id, j]));
      return rows
        .map((t) => {
          const j = jobInfo.get(t.job_id);
          const note = t.notes?.trim() ? ` · notes: ${clip(t.notes.trim().replace(/\s+/g, " "), 200)}` : "";
          return `- [${t.status}] ${t.title} · ${j?.clients?.name ?? "—"}${j && j.kind !== "flow" ? ` / ${j.name}` : ""} · ${people.find((p) => p.id === t.assignee_id)?.name ?? "unassigned"} · due ${t.due_date ?? "—"}${t.debbie_recommended ? " · Debbie Recommends" : ""}${note}`;
        })
        .join("\n");
    }
    case "add_task": {
      const r = await createDebbieTask(
        sb,
        { title: s("title"), client: s("client") || undefined, assignee: s("assignee") || undefined, due_date: s("due_date") || undefined, notes: s("notes") || undefined },
        { meeting_id: null, meeting_title: `Asked in Ask Debbie by ${ctx.userName}`, date: new Date().toISOString(), quote: "" }
      );
      return `Added "${s("title")}" for ${r.client}, owner ${r.assignee}, due ${r.due}.`;
    }
    default:
      return `Unknown tool ${name}.`;
  }
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export async function debbieSystem(sb: SupabaseClient, userName: string) {
  const people = await profiles(sb);
  const today = new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" });
  return `You are Debbie, the ClubSheIs team's memory. ClubSheIs is a digital marketing and content production agency in South Africa. You have the notes of every meeting the team has had in 2026 — the daily Team Scroll, Boardroom, client calls, discovery calls and one-on-ones — plus every task (the Daily Scroll) and every client in the Tracker. Anyone on the team can ask you anything that was said in a meeting, even one they weren't in.

Today is ${today}. You're talking to ${userName}.
The team: ${people.map((p) => `${p.name}${p.job_title ? ` (${p.job_title})` : ""}`).join(", ")}.

How you work:
- Look things up before answering. Search meetings with a few different wordings, read the relevant meetings in full, and check tasks and client status for anything about current work. Never answer from memory or guess.
- Be factual. Say who said what, in which meeting, on which date, e.g. "In Team Scroll on Mon, 5 Oct 2026, Gizelle said …". Quote briefly when the exact words matter.
- Link every meeting you rely on, using its id from the tools: [Team Scroll · 5 Oct](/meetings/MEETING_ID). Link clients the same way when helpful: [Anele Somaguda](/clients/CLIENT_ID) only if you have the id.
- If you can't find something, say so plainly and say what you searched. Don't fill gaps.
- For task updates, give status, owner and due date from the work log, and flag anything overdue or waiting on the client.
- Only add a task when the person explicitly asks you to.
- Keep answers short and scannable: a direct answer first, then the supporting detail. South African English.`;
}

export type DebbieEvent = { type: "status"; text: string } | { type: "text"; text: string };

const STATUS: Record<string, (i: Row) => string> = {
  search_meetings: (i) => `Searching meetings for “${i.query}”${i.client ? ` with ${i.client}` : ""}`,
  read_meeting: () => "Reading meeting notes",
  list_meetings: (i) => `Listing ${i.kind ? KIND_LABEL[i.kind as string] : "meetings"}${i.client ? ` with ${i.client}` : ""}`,
  find_client: (i) => `Looking up ${i.query}`,
  client_status: (i) => `Checking where ${i.client} is at`,
  search_tasks: (i) => `Checking tasks${i.assignee ? ` for ${i.assignee}` : ""}${i.client ? ` on ${i.client}` : ""}`,
  add_task: (i) => `Adding task “${i.title}”`,
};

export async function askDebbie(
  sb: SupabaseClient,
  history: { role: "user" | "assistant"; text: string }[],
  userName: string,
  emit: (e: DebbieEvent) => void
) {
  const anthropic = new Anthropic();
  const system = await debbieSystem(sb, userName);
  // Earlier turns go back as plain text, so every request is append-only.
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.text }));
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await anthropic.beta.messages.create({
      model: DEBBIE_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      tools: DEBBIE_TOOLS as Anthropic.Beta.BetaToolUnion[],
      messages,
    });
    if (res.stop_reason === "refusal") {
      const text = "Sorry, I can't help with that one.";
      emit({ type: "text", text });
      return text;
    }
    messages.push({ role: "assistant", content: res.content });
    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length) {
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      emit({ type: "text", text });
      return text;
    }
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      const input = (u.input ?? {}) as Row;
      emit({ type: "status", text: STATUS[u.name]?.(input) ?? "Looking things up" });
      try {
        results.push({ type: "tool_result", tool_use_id: u.id, content: await runTool(sb, u.name, input, { userName }) });
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: u.id, content: err instanceof Error ? err.message : "Tool failed.", is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  const text = "I looked through a lot and couldn't pin this down. Try asking a narrower question.";
  emit({ type: "text", text });
  return text;
}

// ── Debbie Recommends ────────────────────────────────────────────────────────

const RECOMMEND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tasks"],
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "client", "assignee", "due_date", "quote"],
        properties: {
          title: { type: "string", description: "Short, actionable task title starting with a verb." },
          client: { type: "string", description: "Client or business name, or empty string for internal work." },
          assignee: { type: "string", description: "First name of the team member who should own it, or empty string." },
          due_date: { type: "string", description: "YYYY-MM-DD if a date was said or clearly implied, else empty string." },
          quote: { type: "string", description: "The words from the notes this task comes from." },
        },
      },
    },
  },
} as const;

/**
 * Read a Team Scroll's notes, compare them with the open tasks, and add the
 * ones that were agreed but never captured. Only for recent meetings — old
 * history is marked processed without recommending.
 */
export async function recommendFromTeamScroll(sb: SupabaseClient, meeting: Meeting) {
  const recent = meeting.starts_at && Date.now() - new Date(meeting.starts_at).getTime() < 3 * 864e5;
  if (!recent || !meeting.notes.trim()) {
    await sb.from("meetings").update({ debbie_processed_at: new Date().toISOString() }).eq("id", meeting.id);
    return 0;
  }
  const [people, { data: open }, { data: clients }] = await Promise.all([
    profiles(sb),
    sb.from("tasks").select("title, assignee_id, job_id, status").not("status", "in", "(published,closed_out)").limit(600),
    sb.from("clients").select("name, business_name").eq("is_past_lead", false),
  ]);
  const { data: jobs } = await sb.from("jobs").select("id, clients(name)");
  const jobClient = new Map(((jobs ?? []) as unknown as { id: string; clients: { name: string } | null }[]).map((j) => [j.id, j.clients?.name ?? ""]));
  const openList = ((open ?? []) as Task[])
    .map((t) => `- ${t.title} · ${jobClient.get(t.job_id) ?? ""} · ${people.find((p) => p.id === t.assignee_id)?.name ?? "unassigned"}`)
    .join("\n");

  const anthropic = new Anthropic();
  const stream = anthropic.beta.messages.stream({
    model: DEBBIE_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: RECOMMEND_SCHEMA as unknown as Record<string, unknown> } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: `You are Debbie, the ClubSheIs team's memory. After each Team Scroll you check that every action the team agreed on is captured as a task in the Tracker.

Return only actions that were clearly agreed or assigned in the meeting and that are NOT already covered by an open task (same work, even if worded differently). Skip vague ideas, things already done, and anything you're unsure about. Usually that's between zero and eight tasks. If nothing was missed, return an empty list.

Team: ${people.map((p) => p.name).join(", ")}.
Active clients: ${(clients ?? []).map((c) => (c.business_name ? `${c.name} (${c.business_name})` : c.name)).join("; ")}.`,
    messages: [
      {
        role: "user",
        content: `TEAM SCROLL — ${fmt(meeting.starts_at)}\n\n${clip(meeting.notes, 60000)}\n\n=== OPEN TASKS IN THE TRACKER ===\n${openList || "None."}`,
      },
    ],
  });
  const msg = await stream.finalMessage();
  let added = 0;
  if (msg.stop_reason !== "refusal") {
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const out = JSON.parse(text) as { tasks: { title: string; client: string; assignee: string; due_date: string; quote: string }[] };
    for (const t of out.tasks.slice(0, 12)) {
      await createDebbieTask(
        sb,
        { title: t.title, client: t.client || undefined, assignee: t.assignee || undefined, due_date: t.due_date || undefined, notes: `From Team Scroll, ${fmt(meeting.starts_at)}: “${t.quote}”` },
        { meeting_id: meeting.id, meeting_title: meeting.title, date: meeting.starts_at, quote: t.quote }
      );
      added++;
    }
  }
  await sb.from("meetings").update({ debbie_processed_at: new Date().toISOString() }).eq("id", meeting.id);
  return added;
}

export async function processTeamScrolls(sb: SupabaseClient, limit = 1) {
  // History (e.g. from the backfill) is marked handled in one go: Debbie only
  // recommends from the last few days' Team Scrolls.
  await sb
    .from("meetings")
    .update({ debbie_processed_at: new Date().toISOString() })
    .eq("kind", "team_scroll")
    .is("debbie_processed_at", null)
    .lt("starts_at", new Date(Date.now() - 3 * 864e5).toISOString());
  const { data } = await sb
    .from("meetings")
    .select("*")
    .eq("kind", "team_scroll")
    .is("debbie_processed_at", null)
    .neq("notes", "")
    .order("starts_at", { ascending: false })
    .limit(20);
  let done = 0;
  for (const m of (data ?? []) as Meeting[]) {
    const recent = m.starts_at && Date.now() - new Date(m.starts_at).getTime() < 3 * 864e5;
    if (recent && done >= limit) continue;
    try {
      await recommendFromTeamScroll(sb, m);
    } catch {
      // Try again on the next run.
      continue;
    }
    if (recent) done++;
  }
}
