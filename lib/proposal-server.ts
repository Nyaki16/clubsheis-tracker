// Server-side helpers for the proposal tool: load a proposal task with its
// client and discovery notes, and build the generator prompt.
import type { createClient } from "@/lib/supabase/server";
import type { Client, Task } from "./types";
import { rand, type PricingTier } from "./flow";
import type { ProposalData } from "./proposal-template";

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

export function proposalPrompt(opts: { client: Client; discovery: Task | null; tiers: PricingTier[]; notes?: string }) {
  const { client, discovery, tiers, notes } = opts;
  const ts = discovery?.tool_state ?? {};
  return `You are writing a client proposal for Club She Is, a digital marketing and content production agency in South Africa run by Kopano Shimange and Nyaki Tshabangu.

CLIENT INFO:
- Name: ${client.name}
- Brand: ${client.business_name || "Not specified"}

WHAT THEY TOLD US THEY NEED:
${s(ts.need) || client.call_message || "No notes provided"}

DISCOVERY CALL NOTES / TRANSCRIPT:
${s(ts.transcript) || "Not provided"}

IMPORTANT: Do NOT copy the transcript or notes back. Analyse what the client needs and write a personalised proposal. Reference specific things from the call so it is obvious you listened.

OUR PACKAGES (choose the most suitable based on the discovery call):

${priceList(tiers)}

PACKAGES & PAYMENT LINK: https://www.clubsheis.com/products
${notes ? `\nINSTRUCTIONS FROM THE TEAM FOR THIS PROPOSAL:\n${notes}\n\nFollow these instructions carefully.\n` : ""}
HOW TO FILL THE FIELDS:

- headlineLead / headlineAccent: the cover headline, split in two. The lead is the setup and must end with a trailing space, e.g. "A strategy for launching ". The accent is normally the brand name. Keep the whole headline under about eight words.

- opportunityLead + opportunityParagraphs: a recap of the discovery call in our words, so the client can see we understood them. Three to five substantial paragraphs. Name the specific things they told us — their role, their audience, what they have tried, what they said they are stuck on, the number or goal that matters to them. Be direct about the gap between where they are and where they want to be, without being unkind about it. This section is the reason the proposal lands, so give it real weight.

- planLead + phases: what we will actually do. Use two phases only when the engagement genuinely splits (build first, then grow). Otherwise use a single phase. Each phase body is one full paragraph of concrete work, not a bullet summary.

- investmentLead + investmentNote + cards: one card per package or phase.
  * price and name MUST be copied exactly from the price list above. Never invent, round, discount, or blend prices.
  * totalNote: only when a minimum term applies. It must contain the computed rand total, in the form "3 months · R22,500 total" — multiply the monthly price by the number of months. Never write a bare term like "minimum 3 months" with no total. When no minimum term applies, use an empty string.
  * eyebrow: when phased, the full label in the form "Phase One · Foundation · Months 1 to 3" — the phase number, a short name for the phase, and the month range, separated by middots. Never just "Phase One". When there is only one card, use an empty string.
  * features: the deliverables for that package, written for this client rather than copied verbatim from the list.

- nextSteps: five to seven concrete steps in order, starting with signing and ending with the work being underway.

- closingLines: two or three short lines that build to a point. Each has a lead (ending in a space) and an accent tail carrying the emphasis, e.g. lead "Build the " accent "system." Use their actual goal where you can.

- closingParagraph: two or three sentences, under 45 words in total. Warm, confident, no hard sell.

TONE: Professional but human — like a smart friend who is great at marketing. Not corporate, not salesy. Confident and clear. South African English (organise, optimise, programme). Use the rand symbol as R with a thousands separator.

Do not write any section about who Club She Is is, our services, our results, or the terms and conditions — those are fixed and added automatically. Only produce the client-specific fields.`;
}

export function proposalFilename(client: Pick<Client, "name" | "business_name">) {
  const base = (client.business_name || client.name).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `clubsheis-proposal-${base || "client"}.pdf`;
}
