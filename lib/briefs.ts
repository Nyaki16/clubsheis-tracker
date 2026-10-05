// Project briefs: gather what we know about a piece of client work and build the
// prompt for a one-page team brief. Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Task } from "./types";
import { packageLabel } from "./flow";
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

  // Background that sharpens the brief but isn't enough on its own.
  const ys = flowTasks.find((t) => t.tool === "yellow");
  const yellowSheet = ys ? yellowSheetText(ys.tool_state) : "";
  const proposal = (flowTasks.find((t) => t.tool === "proposal")?.tool_state as { data?: ProposalData } | undefined)?.data;
  const { data: profileDoc } = await sb
    .from("client_documents")
    .select("content")
    .eq("client_id", c.id)
    .eq("kind", "profile")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { client: c, sources, yellowSheet, proposal, profile: String(profileDoc?.content ?? "") };
}

function proposalSummary(p: ProposalData) {
  const plan = p.phases
    .map((ph) => `- ${ph.title}${ph.package ? ` (${ph.package})` : ""}: ${ph.body}${(ph.creates ?? []).map((c) => `\n  · ${c.title}: ${c.detail}`).join("")}`)
    .join("\n");
  const cards = p.cards.map((c) => `- ${c.name}: ${c.price} ${c.cadence}${c.features.length ? ` (includes: ${c.features.join("; ")})` : ""}`).join("\n");
  return `What we proposed:\n${plan}\n\nWhat they're paying for:\n${cards}`;
}

export function briefPrompt(input: Awaited<ReturnType<typeof gatherBriefSources>>, req: BriefRequest) {
  const { client, sources, yellowSheet, proposal, profile } = input;
  return `You are writing a one-page project brief for the ClubSheIs team (a South African digital marketing and content agency). The brief tells a team member exactly what to make for a client and how, so they can start work without going back to the meeting notes.

PROJECT: ${req.title}
CLIENT: ${client.name}${client.business_name ? ` · ${client.business_name}` : ""} · package: ${packageLabel(client.package)}
${req.instructions?.trim() ? `\nWHAT THE TEAM WANTS FROM THIS BRIEF:\n${req.instructions.trim()}\n` : ""}
=== SOURCE NOTES (the brief must come from these) ===
${sources.map((s) => `--- ${s.label}\n${clip(s.text, 30000)}`).join("\n\n")}
${proposal ? `\n=== THE PROPOSAL THEY ACCEPTED OR WERE SENT (background) ===\n${clip(proposalSummary(proposal), 8000)}\n` : ""}${
    yellowSheet ? `\n=== THEIR YELLOW SHEET (background: offer, business, brand voice) ===\n${clip(yellowSheet, 10000)}\n` : ""
  }${profile ? `\n=== CLIENT PROFILE (background) ===\n${clip(profile, 6000)}\n` : ""}
WRITE THE BRIEF IN MARKDOWN, using exactly these sections:

# ${req.title}
One line under the heading: the client, and the deliverable in a few words.

## Objective
Two or three sentences: what this project must achieve for the client and how we'll know it worked.

## What the client told us
Three to six bullets with the specifics that shape the work: their offer, audience, what they've tried, what they want, words or examples they used.

## Deliverables
A numbered list. Each item: **the thing** (bold) then the spec: format, quantity, length or size, platform, and what "done" looks like. Only what was agreed or clearly implied in the notes.

## How to approach it
Bullets with clear instructions: angle and key messages, brand voice, must include, must avoid, references they gave.

## Assets and access
Bullets: what the team needs (logins, brand files, photos, copy) and whether we have it or must ask the client.

## Timeline
Dates or order of work if the notes give them.

## Open questions
Bullets marked [GAP: …] for anything the team must confirm with the client before or during the work.

RULES:
- Fit on one page: about 350 to 550 words in total. Short bullets, no paragraphs longer than three sentences.
- Every line must be specific to this client and this project and must come from the notes. No filler, no generic marketing advice, no restating headings.
- Never invent facts, prices, dates or quantities. If something important isn't in the notes, put it under Open questions as [GAP: …] instead of guessing.
- Write instructions directly to the team member ("Write…", "Use…", "Don't…"). South African English.
- Output only the brief, starting with the # heading.`;
}
