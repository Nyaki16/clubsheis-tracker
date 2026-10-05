// Server-side helpers for the proposal tool: load a proposal task with its
// client and discovery notes, and build the generator prompt.
import type { createClient } from "@/lib/supabase/server";
import type { Client, Task } from "./types";
import { rand, type PricingTier } from "./flow";
import type { PricingCard, ProposalData } from "./proposal-template";

type SB = Awaited<ReturnType<typeof createClient>>;

export type ProposalState = {
  state?: "generating" | "ready" | "sent";
  data?: ProposalData;
  notes?: string;
  email_body?: string | null;
  generated_at?: string;
  sent_at?: string;
  sent_to?: string;
  opened_at?: string | null;
  error?: string;
};

export async function loadProposalContext(supabase: SB, taskId: string) {
  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!task) return null;
  const { data: job } = await supabase.from("jobs").select("client_id").eq("id", task.job_id).single();
  if (!job) return null;
  const [{ data: client }, { data: siblings }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", job.client_id).single(),
    supabase.from("tasks").select("*").eq("job_id", task.job_id),
  ]);
  if (!client) return null;
  const discovery = (siblings as Task[] | null)?.find((t) => t.tool === "discovery") ?? null;
  return { task: task as Task, client: client as Client, discovery, siblings: (siblings ?? []) as Task[] };
}

const s = (v: unknown) => (typeof v === "string" ? v : "");

export function priceList(tiers: PricingTier[]) {
  return tiers
    .map((t, i) => {
      const price = `${t.is_from ? "from " : ""}${rand(t.amount)}${t.cadence === "month" ? "/month" : " once-off"}`;
      const term = t.min_months && t.cadence === "month" ? `, minimum ${t.min_months} months` : "";
      return `${i + 1}. ${t.name.toUpperCase()} (${price}${term})${t.description ? `\n   ${t.description}` : ""}`;
    })
    .join("\n\n");
}

export type ProposalExtras = {
  /** Pricing the team set in the editor: the regenerated proposal must use exactly this. */
  cards?: PricingCard[];
  /** The proposal task's own Notes field. */
  taskNotes?: string;
  /** Other meetings with this client that have notes (newest first). */
  meetings?: { title: string; date: string | null; notes: string }[];
  /** Gemini notes saved on the client, when the Discovery task has no transcript. */
  callNotes?: string;
  /** The client's Yellow Sheet answers, if they've submitted it. */
  yellowSheet?: string;
  /** Debbie's latest Client Profile. */
  profile?: string;
};

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}… [cut]` : t);

function fixedPricing(cards: PricingCard[]) {
  return cards
    .map((c, i) => `${i + 1}. ${c.name} — ${c.price} ${c.cadence}${c.totalNote ? ` (${c.totalNote})` : ""}`)
    .join("\n");
}

export function proposalPrompt(opts: { client: Client; discovery: Task | null; tiers: PricingTier[]; notes?: string } & ProposalExtras) {
  const { client, discovery, tiers, notes, cards, taskNotes, meetings, callNotes, yellowSheet, profile } = opts;
  const ts = discovery?.tool_state ?? {};
  const fixed = cards?.filter((c) => c.name.trim() || c.price.trim()) ?? [];
  return `You are writing a client proposal for Club She Is, a digital marketing and content production agency in South Africa run by Kopano Shimange and Nyaki Tshabangu.

CLIENT INFO:
- Name: ${client.name}
- Brand: ${client.business_name || "Not specified"}

WHAT THEY TOLD US THEY NEED:
${s(ts.need) || client.call_message || "No notes provided"}

DISCOVERY CALL NOTES / TRANSCRIPT:
${s(ts.transcript) || callNotes || "Not provided"}
${yellowSheet ? `\nTHEIR YELLOW SHEET (their own answers about their offer, business and brand voice):\n${clip(yellowSheet, 12000)}\n` : ""}${
  profile ? `\nCLIENT PROFILE (our team's running summary of everything we know about them):\n${clip(profile, 8000)}\n` : ""
}${
  meetings?.length
    ? `\nOTHER CONVERSATIONS WITH THIS CLIENT (newest first, use anything that changes or adds to the picture):\n${meetings
        .map((m) => `--- ${m.title}${m.date ? ` · ${m.date.slice(0, 10)}` : ""}\n${clip(m.notes, 8000)}`)
        .join("\n\n")}\n`
    : ""
}${taskNotes?.trim() ? `\nTEAM NOTES ON THIS PROPOSAL:\n${taskNotes.trim()}\n` : ""}
IMPORTANT: Do NOT copy the transcript or notes back. Analyse what the client needs and write a personalised proposal. Reference specific things from the call so it is obvious you listened.

EVIDENCE RULE: every point in "heard", every opportunity paragraph and every phase body must rest on something in the material above. Use their specifics: names of their products or programmes, prices they charge, numbers they gave, platforms they use, who their customers are, what they tried and what happened. If a sentence would be equally true for any small business, delete it. If the material doesn't cover something, say less rather than filling the gap.

${
  fixed.length
    ? `PRICING CHOSEN BY THE TEAM (this is final):
${fixedPricing(fixed)}

Use exactly these options, in this order, as the cards: copy each name, price, cadence and total word for word. Write each card's eyebrow, subtitle and features to match it. The plan, the investment note, the next steps and the closing must describe these options and nothing else: never mention a package that isn't listed here.

For what each of our packages includes, see the full list:

${priceList(tiers)}`
    : `OUR PACKAGES (choose the most suitable based on the discovery call):

${priceList(tiers)}`
}

PACKAGES & PAYMENT LINK: https://www.clubsheis.com/products
${notes ? `\nINSTRUCTIONS FROM THE TEAM FOR THIS PROPOSAL:\n${notes}\n\nFollow these instructions carefully.\n` : ""}
HOW TO FILL THE FIELDS:

- headlineLead / headlineAccent: the cover headline, split in two. The lead is the setup and must end with a trailing space, e.g. "A strategy for launching ". The accent is normally the brand name. Keep the whole headline under about eight words.

- heard: "What we heard", a summary of the conversation. Four to seven short points covering what the client actually told us: who they are, what they sell and to whom, what they've tried, where they're stuck, and the goal or number that matters to them. Plain words, close to how they said it, one idea per point. This is the client checking that we listened, so stick to what was said; don't add our recommendations here.

- opportunityLead + opportunityParagraphs: a recap of the discovery call in our words, so the client can see we understood them. Three to five substantial paragraphs. Name the specific things they told us — their role, their audience, what they have tried, what they said they are stuck on, the number or goal that matters to them. Be direct about the gap between where they are and where they want to be, without being unkind about it. This section is the reason the proposal lands, so give it real weight.

- planLead + phases + outcomes: Section Three, "What we'll do together". This is the strategy and the main reason they will say yes, so make it specific and persuasive.
  * planLead: the strategy in two or three sentences: the angle we will take for this client and why it fits what they told us.
  * phases: one phase per offering in the pricing, in the same order (so a page build plus a monthly subscription is two phases). Each phase:
    - package: the offering's name exactly as in the pricing, so the reader can see which part of the investment pays for it.
    - title: what this phase achieves for them, e.g. "Phase One · Your sales page · Weeks 1 to 4".
    - body: four to six sentences of strategy: what we will do, in what order and why, built on what they said (their offer, audience, what hasn't worked, their goal). Show how this package solves their specific problem.
    - creates: three to six concrete things we will make or set up, using what the package includes (see the package descriptions). Each has a title naming the actual thing for this client (e.g. "A sales page for the 6-week Glow Reset") and a detail of one or two sentences on what's in it and which problem it fixes, pointing back to something they told us.
  * outcomes: three to five concrete results they can expect once this is in place, tied to the goal they named (e.g. "Clients pay on the page instead of by EFT, so you stop chasing payments"). Never promise specific revenue figures.

- investmentLead + investmentNote + cards: one card per package or phase.
  * price and name MUST be copied exactly from ${fixed.length ? "the pricing chosen by the team" : "the price list above"}. Never invent, round, discount, or blend prices.
  * totalNote: only when a minimum term applies. It must contain the computed rand total, in the form "3 months · R22,500 total" — multiply the monthly price by the number of months. Never write a bare term like "minimum 3 months" with no total. When no minimum term applies, use an empty string.
  * eyebrow: when phased, the full label in the form "Phase One · Foundation · Months 1 to 3" — the phase number, a short name for the phase, and the month range, separated by middots. Never just "Phase One". When there is only one card, use an empty string.
  * features: three to six deliverables for that package, each under ten words, written for this client rather than copied verbatim from the list. The whole investment section must fit on one page, so keep them short; the detail belongs in Section Three.

- nextSteps: five to seven concrete steps in order, starting with signing and ending with the work being underway.

- closingLines: two or three short lines that build to a point. Each has a lead (ending in a space) and an accent tail carrying the emphasis, e.g. lead "Build the " accent "system." Use their actual goal where you can.

- closingParagraph: two or three sentences, under 45 words in total. Warm, confident, no hard sell.

NO FILLER: every sentence must carry information specific to this client or to the work. Never write generic marketing lines, never restate the heading, and never pad a section to look longer. If you don't know something, leave it out rather than inventing it.
Banned phrases and anything like them: "in today's digital world/landscape", "we're excited to", "this is where we come in", "take your business to the next level", "unlock your potential", "elevate your brand", "seamless", "leverage", "game-changer", "stand out from the crowd", "reach your target audience", "online presence", "it's not just about", "we understand that".

TONE: Professional but human — like a smart friend who is great at marketing. Not corporate, not salesy. Confident and clear. South African English (organise, optimise, programme). Use the rand symbol as R with a thousands separator.

Do not write any section about who Club She Is is, our services, our results, or the terms and conditions — those are fixed and added automatically. Only produce the client-specific fields.`;
}

export function proposalFilename(client: Pick<Client, "name" | "business_name">) {
  const base = (client.business_name || client.name).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `clubsheis-proposal-${base || "client"}.pdf`;
}
