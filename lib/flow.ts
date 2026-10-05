// Client flow: phases, packages, built-in tools and the pure helpers shared by
// server actions and UI. The task lists themselves live in the flow_templates
// table (editable in Settings → Package templates).

import type { Task } from "./types";

export const PHASES = [
  { id: "sales", label: "Sales", dot: "bg-amber-500" },
  { id: "onboarding", label: "Onboarding", dot: "bg-sky-500" },
  { id: "yellow", label: "Yellow Sheet", dot: "bg-yellow-500" },
  { id: "production", label: "Production", dot: "bg-rose-500" },
  { id: "delivery", label: "Delivery", dot: "bg-emerald-500" },
] as const;
export type PhaseId = (typeof PHASES)[number]["id"];

export type PackageDef = {
  id: string;
  label: string;
  short: string;
  description: string;
  builtin?: boolean;
  /** Default name when New job uses this package. */
  job_name?: string;
  /** Template size: every task, and the Production + Delivery work alone. */
  tasks?: number;
  work?: number;
};
/** Phases a returning (already onboarded) client skips when a package adds a new job. */
export const SETUP_PHASES = ["sales", "onboarding", "yellow"] as const;
export type PackageId = string;

// The original six. The live list (including packages the team adds) comes from
// the `packages` table: see lib/packages.ts and usePackages().
export const PACKAGES: PackageDef[] = [
  { id: "lead", label: "Package not chosen", short: "No package yet", description: "Sales tasks only until you pick", builtin: true },
  { id: "ghutte", label: "Ghutte Only", short: "Ghutte Only", description: "Onboarding onto Ghutte", builtin: true },
  { id: "page", label: "New Page Build", short: "New Page Build", description: "One page built in Ghutte", builtin: true },
  { id: "content", label: "Content Day", short: "Content Day", description: "Long + short form in studio", builtin: true },
  { id: "ads", label: "Ads + Email + Social", short: "Ads + Email + Social", description: "Meta ads, newsletters, social", builtin: true },
  { id: "full", label: "Full Build", short: "Full Build", description: "Lead magnet, OTO, main product", builtin: true },
];

let known: PackageDef[] = PACKAGES;
/** Make packageLabel() aware of the team's own packages. */
export function setKnownPackages(list: PackageDef[]) {
  if (list.length) known = list;
}

export function packageLabel(id: string | null | undefined, short = false) {
  const p = known.find((x) => x.id === id) ?? PACKAGES.find((x) => x.id === id);
  if (!p) return "No package";
  return short ? p.short || p.label : p.label;
}

export const TOOLS = [
  { id: "discovery", label: "Discovery notes" },
  { id: "proposal", label: "Proposal PDF" },
  { id: "account", label: "Ghutte setup" },
  { id: "checklist", label: "Checklist" },
  { id: "yellow", label: "Yellow Sheet" },
  { id: "gen", label: "AI generator" },
] as const;
export type ToolId = (typeof TOOLS)[number]["id"];

export function toolLabel(id: string | null | undefined) {
  return TOOLS.find((t) => t.id === id)?.label ?? null;
}

// Technical setup / Onboarding Call checklist (from the old tech-onboarding stage;
// the sub-account is its own task with the Create button).
export const TECH_CHECKS = [
  { label: "Domain connected", hint: "Connect the domain to Ghutte. Verify DNS and that SSL is active." },
  { label: "Payment provider linked", hint: "Connect Paystack, Stripe or PayFast. Test a R1 transaction." },
  { label: "Facebook Business Manager connected", hint: "Verify page access and ad account permissions." },
  { label: "Meta Pixel installed", hint: "On all pages. Test with the Pixel Helper extension." },
  { label: "Social accounts linked", hint: "Instagram, LinkedIn, TikTok, YouTube as needed." },
  { label: "Client access verified", hint: "Client can log in to Ghutte and see their dashboard." },
  { label: "Existing contact list uploaded", hint: "Clean and deduplicate before importing." },
];

// What each generator reads. Shown as input chips in the task; tasks not in
// the client's package are left out.
export const TOOL_INPUTS: Record<string, string[]> = {
  "Sales page copy": ["Yellow Sheet"],
  "7-email sequence": ["Yellow Sheet", "Sales page copy"],
  "1 month of content": ["Yellow Sheet", "Sales page copy"],
  "Ad copy": ["Yellow Sheet", "Sales page copy"],
  "Email newsletters": ["Yellow Sheet", "7-email sequence"],
  "Content plan + scripts": ["Yellow Sheet", "1 month of content"],
  "Pre-production prompts": ["Yellow Sheet", "Sales page copy"],
  "Internal check": ["Sales page copy", "7-email sequence"],
  "Hand over": [],
};

export const DONE_STATUSES = new Set(["published", "closed_out"]);
export const isDone = (t: Pick<Task, "status">) => DONE_STATUSES.has(t.status);

export type FlowTemplate = {
  id: string;
  package: PackageId;
  phase: PhaseId;
  position: number;
  title: string;
  tool: ToolId | null;
  default_assignee_id: string | null;
  created_at: string;
};

export type PricingTier = {
  id: string;
  name: string;
  amount: number;
  cadence: "month" | "once";
  min_months: number;
  is_from: boolean;
  description: string;
  position: number;
  created_at: string;
};

export const rand = (n: number) =>
  "R" + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export type ProposalCard = { name: string; price: string; cadence: string; total: string };

export function tierCard(t: Pick<PricingTier, "name" | "amount" | "cadence" | "min_months" | "is_from">): ProposalCard {
  return {
    name: t.name,
    price: (t.is_from ? "from " : "") + rand(t.amount),
    cadence: t.cadence === "month" ? "/month" : "once-off",
    total: t.min_months && t.cadence === "month" ? `${t.min_months} months · ${rand(t.amount * t.min_months)} total` : "",
  };
}

const phaseRank = (p: string | null) => {
  const i = PHASES.findIndex((x) => x.id === p);
  return i < 0 ? PHASES.length : i;
};

export function sortFlowTasks<T extends Pick<Task, "phase" | "position" | "created_at">>(tasks: T[]): T[] {
  return [...tasks].sort(
    (a, b) =>
      phaseRank(a.phase) - phaseRank(b.phase) ||
      (a.position ?? 9999) - (b.position ?? 9999) ||
      a.created_at.localeCompare(b.created_at)
  );
}

// The phase of the first open task. When everything is done, the client sits
// in the last phase they have tasks in (e.g. Sales for "Package not chosen").
export function currentPhase(tasks: Pick<Task, "phase" | "status" | "position" | "created_at">[]): PhaseId | null {
  const sorted = sortFlowTasks(tasks);
  const open = sorted.find((t) => !isDone(t));
  return ((open ?? sorted[sorted.length - 1])?.phase as PhaseId) ?? null;
}

// Switching package keeps tasks the new package also has and anything already
// started; drops untouched tasks the new package doesn't have; adds the new
// package's missing tasks.
export function packageDiff(
  tasks: Pick<Task, "id" | "title" | "status">[],
  template: Pick<FlowTemplate, "title" | "phase" | "position" | "tool" | "default_assignee_id">[]
) {
  const titles = new Set(template.map((t) => t.title));
  const keepStarted = tasks.filter((t) => !titles.has(t.title) && t.status !== "planning");
  const remove = tasks.filter((t) => !titles.has(t.title) && t.status === "planning");
  const add = template.filter((x) => !tasks.some((t) => t.title === x.title));
  return { keepStarted, remove, add };
}

/**
 * Operational: an ongoing client rather than one moving through the flow. The
 * team can move anyone in or out by hand; otherwise it's automatic: their
 * client flow is finished, or they have jobs but no client flow at all.
 */
export function isOperational(client: { operational?: boolean | null }, flowTasks: Pick<Task, "status">[], hasOtherJobs: boolean) {
  if (client.operational === true) return true;
  if (client.operational === false) return false;
  if (flowTasks.length) return flowTasks.every(isDone);
  return hasOtherJobs;
}
