// One-off import of clients from the retired Client Flow app into the
// Tracker's client flow. Server-only (service-role clients on both sides).
//
// plan()  — reads everything and reports what would happen per client.
// apply() — writes it. Safe to re-run: clients are keyed by client_flow_id.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CLIENT_COLORS } from "./constants";
import { PHASES, type FlowTemplate, type PackageId, type PhaseId } from "./flow";

type Row = Record<string, unknown>;

// Clients the team confirmed are tests (2026-10-05).
const TEST_NAMES = new Set(["nyaki tshabangu", "nyaki tshabangu2", "nyaki tshabangu test", "nyaki test", "tumi"]);

const PACKAGE_MAP: Record<string, PackageId> = {
  "ghutte-only": "ghutte",
  "page-build": "page",
  "content-day": "content",
  "ads-email-social": "ads",
  "full-build": "full",
};

// How far along each old stage means the client is, in new-flow terms:
// every task in a phase listed here is treated as done.
const PHASES_DONE: Record<string, PhaseId[]> = {
  discovery: [],
  proposal: [],
  "awaiting-review": [],
  onboarding: ["sales"],
  "tech-onboarding": ["sales"],
  "business-info": ["sales"],
  strategy: ["sales", "onboarding"],
  "funnel-strategy": ["sales", "onboarding"],
  "strategy-brief": ["sales", "onboarding"],
  "project-strategy": ["sales", "onboarding"],
  "implementation-plan": ["sales", "onboarding"],
  "funnel-map": ["sales", "onboarding"],
  "copy-bible": ["sales", "onboarding"],
  "brand-bible": ["sales", "onboarding"],
  "pre-production": ["sales", "onboarding", "yellow"],
  production: ["sales", "onboarding", "yellow"],
  "content-production": ["sales", "onboarding", "yellow"],
  "ads-email-social": ["sales", "onboarding", "yellow"],
  "internal-check": ["sales", "onboarding", "yellow", "production"],
  handover: ["sales", "onboarding", "yellow", "production"],
  retainer: ["sales", "onboarding", "yellow", "production", "delivery"],
  wrapup: ["sales", "onboarding", "yellow", "production", "delivery"],
};

const LEAD_STATUS: Record<string, string> = { "good fit": "Good fit", "not a fit": "Not a fit", "follow up": "Follow up" };

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const str = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const day = (d: Date) => d.toISOString().slice(0, 10);

export type PlanItem = {
  flowId: string;
  name: string;
  business: string;
  email: string;
  oldPackage: string;
  oldStage: string;
  package: PackageId;
  action: "create" | "match" | "skip";
  matchName?: string;
  reason?: string;
  carries: string[];
};

function clientFlowDb() {
  const url = process.env.CLIENT_FLOW_SUPABASE_URL;
  const key = process.env.CLIENT_FLOW_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("CLIENT_FLOW_SUPABASE_URL / CLIENT_FLOW_SUPABASE_SERVICE_ROLE_KEY aren't set for this deployment.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function load(tracker: SupabaseClient) {
  const cf = clientFlowDb();
  const [clientsRes, dataRes, compRes, trackerClients, flowJobs] = await Promise.all([
    cf.from("flow_clients").select("*").order("created_at"),
    cf.from("flow_stage_data").select("client_id, stage_key, field_key, field_value").limit(20000),
    cf.from("flow_stage_completions").select("client_id, stage_key, substep_index, completed").limit(20000),
    tracker.from("clients").select("id, name, business_name, email, client_flow_id"),
    tracker.from("jobs").select("client_id").eq("kind", "flow"),
  ]);
  if (clientsRes.error) throw new Error(`Client Flow: ${clientsRes.error.message}`);
  if (trackerClients.error) throw new Error(`Tracker: ${trackerClients.error.message}`);

  const data = new Map<string, Map<string, string>>();
  for (const r of (dataRes.data ?? []) as Row[]) {
    const id = String(r.client_id);
    if (!data.has(id)) data.set(id, new Map());
    data.get(id)!.set(`${r.stage_key}:${r.field_key}`, String(r.field_value ?? ""));
  }
  const checks = new Map<string, Set<number>>();
  for (const r of (compRes.data ?? []) as Row[]) {
    if (r.stage_key !== "tech-onboarding" || !r.completed) continue;
    const id = String(r.client_id);
    if (!checks.has(id)) checks.set(id, new Set());
    checks.get(id)!.add(Number(r.substep_index));
  }
  return {
    flowClients: (clientsRes.data ?? []) as Row[],
    data,
    checks,
    trackerClients: (trackerClients.data ?? []) as Row[],
    withFlow: new Set(((flowJobs.data ?? []) as Row[]).map((j) => String(j.client_id))),
  };
}

function carries(d: Map<string, string> | undefined) {
  if (!d) return [];
  const out: string[] = [];
  if (d.get("discovery:what_they_need") || d.get("discovery:call_transcript")) out.push("discovery notes");
  if (d.get("proposal:proposal_data")) out.push("proposal + PDF");
  else if (d.get("proposal:generated_text")) out.push("proposal text");
  if (d.get("onboarding:ghl_location_id")) out.push("Ghutte sub-account");
  if ([...d.keys()].some((k) => k.startsWith("copy-bible:element_"))) out.push("copy drafts");
  if (["strategy:client_profile_text", "strategy:research_bible_text", "strategy:brand_voice_text", "strategy-brief:brief_text", "project-strategy:brief_text"].some((k) => d.get(k)))
    out.push("strategy docs (archived)");
  return out;
}

export async function plan(tracker: SupabaseClient): Promise<PlanItem[]> {
  const ctx = await load(tracker);
  const byFlowId = new Map(ctx.trackerClients.filter((c) => c.client_flow_id).map((c) => [String(c.client_flow_id), c]));
  const byEmail = new Map(ctx.trackerClients.filter((c) => c.email).map((c) => [norm(c.email), c]));
  const byName = new Map<string, Row>();
  for (const c of ctx.trackerClients) {
    byName.set(norm(c.name), c);
    if (c.business_name) byName.set(norm(c.business_name), c);
  }

  return ctx.flowClients.map((fc) => {
    const id = String(fc.id);
    const name = str(fc.name).replace(/\s+/g, " ");
    const base: PlanItem = {
      flowId: id,
      name,
      business: str(fc.brand),
      email: str(fc.email).toLowerCase(),
      oldPackage: str(fc.package) || "none",
      oldStage: str(fc.current_stage),
      package: PACKAGE_MAP[str(fc.package)] ?? "lead",
      action: "create",
      carries: carries(ctx.data.get(id)),
    };
    if (TEST_NAMES.has(norm(name))) return { ...base, action: "skip", reason: "Test client" };
    const already = byFlowId.get(id);
    if (already) return { ...base, action: "skip", reason: `Already imported as ${already.name}` };
    const match = byEmail.get(base.email) ?? byName.get(norm(name)) ?? (base.business ? byName.get(norm(base.business)) : undefined);
    if (match) {
      if (ctx.withFlow.has(String(match.id))) return { ...base, action: "skip", matchName: String(match.name), reason: `${match.name} already has a client flow in the Tracker` };
      return { ...base, action: "match", matchName: String(match.name) };
    }
    return base;
  });
}

export async function apply(tracker: SupabaseClient) {
  const ctx = await load(tracker);
  const items = await plan(tracker);
  const { data: tplRows } = await tracker.from("flow_templates").select("*");
  const templates = (tplRows ?? []) as FlowTemplate[];
  const { data: profiles } = await tracker.from("profiles").select("id, email, name");
  const gizelle = (profiles ?? []).find((p) => /^gizelle@/i.test(p.email) || /^gizelle/i.test(p.name))?.id ?? null;
  let colour = ctx.trackerClients.length;
  const results: { name: string; action: string; tasks: number; error?: string }[] = [];

  for (const item of items) {
    if (item.action === "skip") continue;
    const fc = ctx.flowClients.find((c) => String(c.id) === item.flowId)!;
    const d = ctx.data.get(item.flowId) ?? new Map<string, string>();
    try {
      const fields = {
        email: item.email || null,
        phone: str(fc.phone) || null,
        website_url: str(fc.website) || null,
        package: item.package,
        lead_id: gizelle,
        source: "client_flow",
        client_flow_id: item.flowId,
        clock_started_on: str(d.get("timeline:start_date")) || null,
        call_message: str(fc.needs) || null,
      };
      let clientId: string;
      if (item.action === "match") {
        const match = ctx.trackerClients.find((c) => norm(c.name) === norm(item.matchName));
        clientId = String(match!.id);
        const keep = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v !== null || k === "package"));
        await tracker.from("clients").update({ ...keep, business_name: (match!.business_name as string) || item.business || null }).eq("id", clientId);
      } else {
        const { data: created, error } = await tracker
          .from("clients")
          .insert({ name: item.name, business_name: item.business || null, color: CLIENT_COLORS[colour++ % CLIENT_COLORS.length], ...fields })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        clientId = created.id;
      }
      const n = await issueWithHistory(tracker, clientId, item, d, ctx.checks.get(item.flowId), templates, gizelle);
      await archiveStrategyDocs(tracker, clientId, d);
      results.push({ name: item.name, action: item.action, tasks: n });
    } catch (err) {
      results.push({ name: item.name, action: item.action, tasks: 0, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

async function issueWithHistory(
  sb: SupabaseClient,
  clientId: string,
  item: PlanItem,
  d: Map<string, string>,
  checks: Set<number> | undefined,
  templates: FlowTemplate[],
  leadId: string | null
) {
  const { data: job, error } = await sb
    .from("jobs")
    .insert({ client_id: clientId, name: "Client flow", kind: "flow", stage: "briefing" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const tpl = templates
    .filter((t) => t.package === item.package)
    .sort((a, b) => PHASES.findIndex((p) => p.id === a.phase) - PHASES.findIndex((p) => p.id === b.phase) || a.position - b.position);
  const donePhases = new Set(PHASES_DONE[item.oldStage] ?? []);
  const proposalStatus = str(d.get("awaiting-review:proposal_status")) || str(d.get("proposal:proposal_status"));
  const sent = /sent|viewed|accepted|revising|declined/i.test(proposalStatus);
  const today = new Date();
  let firstOpen = true;

  const rows = tpl.map((t) => {
    let status = donePhases.has(t.phase) ? "closed_out" : "planning";
    const ts: Record<string, unknown> = {};
    let notes = "";
    let due: string | null = null;

    switch (t.tool) {
      case "discovery":
        Object.assign(ts, {
          need: str(d.get("discovery:what_they_need")),
          transcript: str(d.get("discovery:call_transcript")),
          link: str(d.get("discovery:transcript_link")),
          lead: LEAD_STATUS[norm(d.get("discovery:lead_status"))] ?? "",
        });
        if (d.get("proposal:thankyou_text")) ts.thanks = str(d.get("proposal:thankyou_text"));
        if (item.oldStage !== "discovery") status = "closed_out";
        break;
      case "proposal": {
        const raw = d.get("proposal:proposal_data");
        if (raw) {
          try {
            ts.data = JSON.parse(raw);
            ts.state = sent ? "sent" : "ready";
            ts.email_body = str(d.get("proposal:email_body")) || null;
            if (sent) Object.assign(ts, { sent_to: item.email, sent_at: null, opened_at: /viewed|accepted/i.test(proposalStatus) ? "before import" : null });
          } catch {
            /* fall through to text */
          }
        }
        if (!ts.data && d.get("proposal:generated_text")) notes = `Proposal from the old Client Flow app:\n\n${d.get("proposal:generated_text")}`;
        if (sent || !["discovery", "proposal"].includes(item.oldStage)) status = "closed_out";
        break;
      }
      case "account":
        if (d.get("onboarding:ghl_location_id")) {
          Object.assign(ts, { state: "done", location_id: d.get("onboarding:ghl_location_id"), url: d.get("onboarding:ghl_url") ?? "" });
          status = "closed_out";
        }
        break;
      case "checklist": {
        // Old substep 0 was "sub-account created"; 1-7 map onto the checklist.
        const c = [1, 2, 3, 4, 5, 6, 7].map((i) => !!checks?.has(i));
        ts.checks = c;
        if (c.every(Boolean)) status = "closed_out";
        else if (c.some(Boolean) && status !== "closed_out") status = "in_progress";
        break;
      }
      case "yellow": {
        const voice = str(d.get("strategy:brand_voice_text"));
        Object.assign(ts, { business_name: str(d.get("business-info:business_name")) || item.business, voice: voice.slice(0, 8000) });
        break;
      }
      case "gen": {
        const pick = (k: string) => str(d.get(k));
        const text =
          t.title === "Sales page copy"
            ? pick("copy-bible:element_0_page_text") || pick("copy-bible:element_0_text")
            : t.title === "7-email sequence"
            ? pick("copy-bible:element_0_email_text")
            : t.title === "Pre-production prompts"
            ? [0, 1, 2, 3, 4].map((i) => pick(`pre-production:prompt_${i}`)).filter(Boolean).join("\n\n---\n\n")
            : t.title === "Internal check"
            ? pick("internal-check:qa_report")
            : "";
        if (text) {
          const approved = t.title === "Sales page copy" ? d.get("copy-bible:element_0_page_approved") === "true" : t.title === "7-email sequence" ? d.get("copy-bible:element_0_email_approved") === "true" : false;
          Object.assign(ts, { text, state: approved ? "approved" : "draft", imported: true });
          if (status !== "closed_out") status = approved ? "internally_reviewed" : "in_review";
        }
        break;
      }
    }
    if (t.title === "Follow up on proposal") {
      due = str(d.get("awaiting-review:follow_up_date")) || null;
      notes = str(d.get("awaiting-review:client_feedback"));
      if (item.oldStage === "awaiting-review") status = "awaiting_client";
    }
    if (status !== "closed_out" && firstOpen) {
      firstOpen = false;
      if (status === "planning") status = "in_progress";
    }
    return {
      job_id: job.id,
      title: t.title,
      phase: t.phase,
      position: t.position,
      tool: t.tool,
      tool_state: ts,
      notes,
      status,
      assignee_id: t.default_assignee_id ?? leadId,
      due_date: due ?? day(new Date(today.getTime() + 3 * 864e5)),
    };
  });
  if (rows.length) {
    const { error: e2 } = await sb.from("tasks").insert(rows);
    if (e2) throw new Error(e2.message);
  }
  return rows.length;
}

// The retired strategy documents, kept as closed tasks in an archive job.
async function archiveStrategyDocs(sb: SupabaseClient, clientId: string, d: Map<string, string>) {
  const docs = [
    ["Client Profile", "strategy:client_profile_text"],
    ["Research Bible", "strategy:research_bible_text"],
    ["Brand Voice", "strategy:brand_voice_text"],
    ["Funnel Strategy", "funnel-strategy:funnel_strategy_text"],
    ["Paid Media Creative Brief", "strategy-brief:brief_text"],
    ["Project Strategy", "project-strategy:brief_text"],
    ["Strategy session transcript", "strategy:session_transcript"],
  ].filter(([, k]) => str(d.get(k)));
  if (!docs.length) return;
  const { data: job, error } = await sb
    .from("jobs")
    .insert({ client_id: clientId, name: "Client Flow archive", kind: "job", stage: "delivered" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await sb.from("tasks").insert(
    docs.map(([title, k]) => ({ job_id: job.id, title, notes: str(d.get(k)), status: "closed_out" }))
  );
}
