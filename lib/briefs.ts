// Project briefs: gather what we know about a piece of client work and build the
// prompt for a one-page team brief. Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Task } from "./types";
import { PHASES, packageLabel, rand, type FlowTemplate, type PricingTier } from "./flow";
import { loadPackages } from "./packages";
import { yellowSheetText } from "./yellow-sheet";
import type { ProposalData } from "./proposal-template";

export type BriefRequest = {
  clientId: string;
  /** Regenerate this brief instead of creating a new one. */
  briefId?: string | null;
  title: string;
  /** What the brief is for, or anything the team wants it to stress. */
  instructions?: string;
  useDiscovery: boolean;
  meetingIds: string[];
  links: string[];
  pasted?: string;
  /** Brief one part of the proposal only: a phase title from Section Three. */
  focus?: string | null;
};

type Source = { label: string; text: string };

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}… [cut]` : t);
export const wordCount = (t: unknown) => String(t ?? "").split(/\s+/).filter(Boolean).length;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "";

function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
}

// Only public web addresses: no localhost or private networks.
function safeUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/.test(h)) return null;
  return u;
}

/**
 * Read a link the team pasted. Gemini notes we already hold (from the calendar
 * sync) are used straight from the database; other Google Docs need "Anyone
 * with the link"; any other page is fetched and reduced to its text.
 */
async function readLink(sb: SupabaseClient, raw: string): Promise<Source> {
  const docId = raw.match(/docs\.google\.com\/document\/d\/([\w-]+)/)?.[1];
  if (docId) {
    const { data: m } = await sb.from("meetings").select("title, starts_at, notes").ilike("notes_url", `%${docId}%`).neq("notes", "").limit(1).maybeSingle();
    if (m) return { label: `${m.title} · ${fmtDate(m.starts_at)}`, text: m.notes };
    const { data: c } = await sb.from("clients").select("name, call_notes").ilike("call_notes_url", `%${docId}%`).not("call_notes", "is", null).limit(1).maybeSingle();
    if (c?.call_notes) return { label: `Discovery call notes · ${c.name}`, text: c.call_notes };
  }
  const url = safeUrl(docId ? `https://docs.google.com/document/d/${docId}/export?format=txt` : raw);
  if (!url) throw new Error(`“${raw}” isn't a web link the Tracker can open.`);
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "User-Agent": "ClubSheIs-Tracker/1.0" } });
  } catch {
    throw new Error(`Couldn't open ${raw}. Check the link, or paste the text instead.`);
  }
  const type = res.headers.get("content-type") ?? "";
  const body = await res.text();
  // A private Google Doc answers with its sign-in page rather than the text.
  if (!res.ok || (docId && !type.includes("text/plain"))) {
    throw new Error(
      docId
        ? `Couldn't read that Google Doc (${raw}). Set sharing to “Anyone with the link can view”, or paste its text instead.`
        : `Couldn't read ${raw} (error ${res.status}). Paste the text instead.`
    );
  }
  const text = type.includes("html") ? htmlToText(body) : body.trim();
  if (wordCount(text) < 20) throw new Error(`${raw} has almost no readable text. Paste the text instead.`);
  return { label: docId ? "Google Doc" : url.hostname, text };
}

export async function gatherBriefSources(sb: SupabaseClient, req: BriefRequest) {
  await loadPackages(sb);
  const { data: client } = await sb.from("clients").select("*").eq("id", req.clientId).single();
  if (!client) throw new Error("Client not found.");
  const c = client as Client;

  const { data: jobs } = await sb.from("jobs").select("id, kind").eq("client_id", c.id);
  const flow = (jobs ?? []).find((j) => j.kind === "flow");
  const { data: flowRows } = flow ? await sb.from("tasks").select("*").eq("job_id", flow.id) : { data: [] };
  const flowTasks = (flowRows ?? []) as Task[];

  const sources: Source[] = [];
  if (req.useDiscovery) {
    const disc = flowTasks.find((t) => t.tool === "discovery");
    const ts = (disc?.tool_state ?? {}) as Record<string, string>;
    const text = [ts.need && `What they need: ${ts.need}`, (ts.transcript || c.call_notes) && `Notes / transcript:\n${ts.transcript || c.call_notes}`, c.call_message && `Booking message: ${c.call_message}`]
      .filter(Boolean)
      .join("\n\n");
    if (text.trim()) sources.push({ label: "Discovery call", text });
  }
  if (req.meetingIds.length) {
    const { data: ms } = await sb.from("meetings").select("id, title, starts_at, notes").in("id", req.meetingIds);
    for (const m of ms ?? []) if (m.notes?.trim()) sources.push({ label: `${m.title} · ${fmtDate(m.starts_at)}`, text: m.notes });
  }
  for (const link of req.links.map((l) => l.trim()).filter(Boolean).slice(0, 6)) sources.push(await readLink(sb, link));
  if (req.pasted?.trim()) sources.push({ label: "Notes added by the team", text: req.pasted.trim() });

  // The scope: what the client is buying. The brief turns this into work.
  const proposalTask = flowTasks.find((t) => t.tool === "proposal");
  const proposalState = (proposalTask?.tool_state ?? {}) as { data?: ProposalData; sent_at?: string; state?: string };
  const proposal = proposalState.data ?? null;
  const [{ data: tierRows }, { data: templateRows }, { data: people }, { data: pkgRow }] = await Promise.all([
    sb.from("pricing_tiers").select("*"),
    c.package && c.package !== "lead" ? sb.from("flow_templates").select("*").eq("package", c.package).order("position") : Promise.resolve({ data: [] }),
    sb.from("profiles").select("id, name"),
    c.package ? sb.from("packages").select("label, description").eq("id", c.package).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const cardNames = new Set((proposal?.cards ?? []).map((k) => k.name.trim().toLowerCase()));
  const tiers = ((tierRows ?? []) as PricingTier[]).filter((t) => cardNames.has(t.name.trim().toLowerCase()));
  const who = (id: string | null) => (people ?? []).find((p) => p.id === id)?.name ?? "the client's lead";
  const packageWork = ((templateRows ?? []) as FlowTemplate[])
    .filter((t) => t.phase === "production" || t.phase === "delivery")
    .map((t) => `- ${t.title} (${PHASES.find((p) => p.id === t.phase)?.label}, ${who(t.default_assignee_id)})`)
    .join("\n");

  // Background that sharpens the brief.
  const ys = flowTasks.find((t) => t.tool === "yellow");
  const yellowSheet = ys ? yellowSheetText(ys.tool_state) : "";
  const { data: profileDoc } = await sb
    .from("client_documents")
    .select("content")
    .eq("client_id", c.id)
    .eq("kind", "profile")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    client: c,
    sources,
    yellowSheet,
    proposal,
    proposalSentAt: proposalState.sent_at ?? null,
    tiers,
    packageInfo: pkgRow as { label: string; description: string } | null,
    packageWork,
    team: (people ?? []).map((p) => p.name).join(", "),
    profile: String(profileDoc?.content ?? ""),
  };
}

function proposalScope(p: ProposalData, focus?: string | null) {
  const phases = focus ? p.phases.filter((ph) => ph.title === focus) : p.phases;
  const plan = (phases.length ? phases : p.phases)
    .map(
      (ph) =>
        `### ${ph.title}${ph.package ? ` — paid for by: ${ph.package}` : ""}\n${ph.body}${
          ph.creates?.length ? `\nWhat we promised to create:\n${ph.creates.map((c) => `- ${c.title}: ${c.detail}`).join("\n")}` : ""
        }`
    )
    .join("\n\n");
  const cards = p.cards
    .map((c) => `- ${c.name}: ${c.price} ${c.cadence}${c.totalNote ? ` (${c.totalNote})` : ""}${c.features.length ? `\n  Includes: ${c.features.join("; ")}` : ""}`)
    .join("\n");
  return [
    p.planLead && `Strategy: ${p.planLead}`,
    `What they're paying for:\n${cards}`,
    `What we'll do together (Section Three of the proposal):\n${plan}`,
    p.outcomes?.length && `Results we promised:\n${p.outcomes.map((o) => `- ${o}`).join("\n")}`,
    p.heard?.length && `What we heard on the call:\n${p.heard.map((h) => `- ${h}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function briefPrompt(input: Awaited<ReturnType<typeof gatherBriefSources>>, req: BriefRequest) {
  const { client, sources, yellowSheet, proposal, proposalSentAt, tiers, packageInfo, packageWork, team, profile } = input;
  const scope = [
    `Package: ${packageInfo?.label ?? packageLabel(client.package)}${packageInfo?.description ? ` (${packageInfo.description})` : ""}`,
    proposal
      ? `PROPOSAL${proposalSentAt ? ` (sent ${new Date(proposalSentAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })})` : " (draft)"}:\n${proposalScope(proposal, req.focus)}`
      : "No proposal has been written for this client yet.",
    tiers.length && `How we define what they bought:\n${tiers.map((t) => `- ${t.name} (${rand(t.amount)}${t.cadence === "month" ? "/month" : " once-off"}): ${t.description}`).join("\n")}`,
    packageWork && `Our standard production and delivery work for this package (task, phase, owner):\n${packageWork}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return `You are writing a one-page production brief for the ClubSheIs team (a South African digital marketing and content agency). The brief turns what the client is buying into exact work, so the team member can start without reading the proposal or the call notes.

PROJECT: ${req.title}
CLIENT: ${client.name}${client.business_name ? ` · ${client.business_name}` : ""}
TEAM: ${team}. Gizelle leads client work and is the client's contact; Mpume builds pages; Xoli makes video and content; Nyaki does quality checks.
${req.focus ? `\nTHIS BRIEF COVERS ONLY THIS PART OF THE PROPOSAL: ${req.focus}. Leave the other parts out.\n` : ""}${req.instructions?.trim() ? `\nWHAT THE TEAM WANTS FROM THIS BRIEF:\n${req.instructions.trim()}\n` : ""}
=== 1. THE SCOPE (what they're paying for: the brief is built on this) ===
${clip(scope, 16000)}

=== 2. THE CLIENT'S OWN WORDS (the detail that makes each deliverable specific) ===
${sources.map((s) => `--- ${s.label}\n${clip(s.text, 30000)}`).join("\n\n") || "No notes ticked."}
${yellowSheet ? `\n=== 3. THEIR YELLOW SHEET (offer, business, brand voice) ===\n${clip(yellowSheet, 10000)}\n` : ""}${
    profile ? `\n=== 4. CLIENT PROFILE ===\n${clip(profile, 6000)}\n` : ""
  }
HOW TO BUILD THE BRIEF:
- Start from the scope. Every deliverable must be something in the proposal's "What we promised to create", the package inclusions, or our standard work for this package. Then make it specific with the client's own details: their offer and its name, price, audience, the problems and objections they mentioned, examples and links they gave, their goal and numbers.
- Make each deliverable production-ready, not a label. A page build lists the page's sections in order, each with its job and key message, plus forms, checkout and integrations. Copy lists each piece with its purpose, angle and call to action. Content lists each piece with format, hook or topic and where it goes. Emails list each email with its job in the sequence and subject-line angle. Ads list audiences, offer and creative angles.
- If the client asked for something the scope doesn't cover, put it under Out of scope so nobody builds it unpaid.
- Never invent facts, prices, dates or quantities. Anything important that's missing goes under Open questions as [GAP: …].

WRITE THE BRIEF IN MARKDOWN, using exactly these sections:

# ${req.title}
One line: the client, the package, and what this brief delivers.

## Scope
Two or three bullets: what's being paid for (package and price as in the proposal) and what this brief covers. Then a line **Out of scope:** listing anything discussed that isn't paid for (or "Nothing discussed outside the scope").

## Objective
Two or three sentences: what this work must achieve for the client, using the goal and results from the proposal, and how we'll know it worked.

## The client in brief
Three to five bullets the team must know: offer, audience, what they've tried, what's stuck, voice. Specifics only.

## Deliverables
Numbered. Each: **the thing** (bold), the owner from the team in brackets, then the production-ready spec as short sub-bullets, ending with "Done when: …".

## Instructions
Bullets written to the team member ("Write…", "Use…", "Don't…"): angle and key messages, brand voice, must include, must avoid, references.

## Assets and access
Bullets: what's needed (logins, brand files, photos, testimonials, copy) and whether we have it or must ask the client via Gizelle.

## Timeline
Order of work and dates if known; otherwise the order of work.

## Open questions
Bullets marked [GAP: …].

RULES:
- One page: about 450 to 700 words. Short bullets; no paragraph longer than three sentences.
- Every line must be specific to this client and this scope. No filler, no generic marketing advice, no restating headings.
- South African English. Output only the brief, starting with the # heading.`;
}
