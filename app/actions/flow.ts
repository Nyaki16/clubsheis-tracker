"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_COLORS } from "@/lib/constants";
import { packageDiff, PHASES, type FlowTemplate, type PackageId, type PhaseId } from "@/lib/flow";

function revalidateFlow(clientId?: string) {
  revalidatePath("/home");
  revalidatePath("/clients");
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/daily");
  revalidatePath("/dashboard");
  revalidatePath("/team");
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const phaseIndex = (p: string) => PHASES.findIndex((x) => x.id === p);

async function loadTemplate(supabase: Awaited<ReturnType<typeof createClient>>, pkg: PackageId) {
  const { data, error } = await supabase
    .from("flow_templates")
    .select("*")
    .eq("package", pkg)
    .order("position");
  if (error) throw new Error(error.message);
  return ((data ?? []) as FlowTemplate[]).sort(
    (a, b) => phaseIndex(a.phase) - phaseIndex(b.phase) || a.position - b.position
  );
}

async function getOrCreateFlowJob(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string) {
  const { data: existing } = await supabase
    .from("jobs")
    .select("id")
    .eq("client_id", clientId)
    .eq("kind", "flow")
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await supabase
    .from("jobs")
    .insert({ client_id: clientId, name: "Client flow", kind: "flow", stage: "briefing" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

// Due dates: spread the issued tasks two days apart from the start date.
function taskRows(jobId: string, template: FlowTemplate[], start: Date, fallbackAssignee: string | null, offset = 0) {
  return template.map((t, i) => ({
    job_id: jobId,
    title: t.title,
    phase: t.phase,
    position: t.position,
    tool: t.tool,
    tool_state: {},
    assignee_id: t.default_assignee_id ?? fallbackAssignee,
    due_date: isoDay(addDays(start, (offset + i) * 2)),
    status: "planning",
    notes: "",
  }));
}

export type FlowClientInput = {
  name: string;
  business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  google_drive_url?: string | null;
  package: PackageId;
  lead_id?: string | null;
};

const clean = (v: string | null | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function createFlowClient(input: FlowClientInput): Promise<{ id: string; issued: number }> {
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name) throw new Error("Add the client's name.");

  const { count } = await supabase.from("clients").select("*", { count: "exact", head: true });
  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name,
      color: CLIENT_COLORS[(count ?? 0) % CLIENT_COLORS.length],
      business_name: clean(input.business_name),
      email: clean(input.email),
      phone: clean(input.phone),
      website_url: clean(input.website_url),
      instagram_url: clean(input.instagram_url),
      google_drive_url: clean(input.google_drive_url),
      package: input.package,
      lead_id: input.lead_id ?? null,
      source: "manual",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const issued = await issueFlow(client.id, input.package, input.lead_id ?? null);
  revalidateFlow(client.id);
  return { id: client.id, issued };
}

async function issueFlow(clientId: string, pkg: PackageId, leadId: string | null) {
  const supabase = await createClient();
  const jobId = await getOrCreateFlowJob(supabase, clientId);
  const template = await loadTemplate(supabase, pkg);
  if (!template.length) return 0;
  const { error } = await supabase.from("tasks").insert(taskRows(jobId, template, new Date(), leadId));
  if (error) throw new Error(error.message);
  return template.length;
}

// For clients that existed before the flow (no flow job yet).
export async function startFlow(clientId: string, pkg: PackageId) {
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("lead_id").eq("id", clientId).single();
  await supabase.from("clients").update({ package: pkg }).eq("id", clientId);
  const issued = await issueFlow(clientId, pkg, client?.lead_id ?? null);
  revalidateFlow(clientId);
  return { issued };
}

export async function changeClientPackage(clientId: string, pkg: PackageId) {
  const supabase = await createClient();
  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select("id, lead_id")
    .eq("id", clientId)
    .single();
  if (cErr) throw new Error(cErr.message);

  const jobId = await getOrCreateFlowJob(supabase, clientId);
  const [{ data: tasks }, template] = await Promise.all([
    supabase.from("tasks").select("id, title, status").eq("job_id", jobId),
    loadTemplate(supabase, pkg),
  ]);
  const { remove, add } = packageDiff(tasks ?? [], template);

  if (remove.length) {
    const { error } = await supabase.from("tasks").delete().in("id", remove.map((t) => t.id));
    if (error) throw new Error(error.message);
  }
  if (add.length) {
    const { error } = await supabase
      .from("tasks")
      .insert(taskRows(jobId, add as FlowTemplate[], new Date(), client.lead_id ?? null, 1));
    if (error) throw new Error(error.message);
  }
  // Re-number positions to follow the new template where titles match.
  for (const t of template) {
    await supabase.from("tasks").update({ position: t.position, phase: t.phase }).eq("job_id", jobId).eq("title", t.title);
  }
  const { error } = await supabase.from("clients").update({ package: pkg }).eq("id", clientId);
  if (error) throw new Error(error.message);

  revalidateFlow(clientId);
  return { added: add.length, removed: remove.length };
}

export type ClientDetailsInput = {
  name?: string;
  business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  google_drive_url?: string | null;
  lead_id?: string | null;
};

export async function updateClientDetails(clientId: string, input: ClientDetailsInput) {
  const supabase = await createClient();
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    payload[k] = k === "lead_id" ? v || null : clean(v as string | null);
  }
  if (payload.name === null) delete payload.name;
  if (!Object.keys(payload).length) return;
  const { error } = await supabase.from("clients").update(payload).eq("id", clientId);
  if (error) throw new Error(error.message);
  revalidateFlow(clientId);
}

export async function addFlowTask(clientId: string, phase: PhaseId, title: string, assigneeId: string | null) {
  const supabase = await createClient();
  const name = title.trim();
  if (!name) return;
  const jobId = await getOrCreateFlowJob(supabase, clientId);
  const { data: last } = await supabase
    .from("tasks")
    .select("position")
    .eq("job_id", jobId)
    .eq("phase", phase)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("tasks").insert({
    job_id: jobId,
    title: name,
    phase,
    position: (last?.position ?? 0) + 1,
    assignee_id: assigneeId,
    due_date: isoDay(addDays(new Date(), 3)),
    status: "planning",
    notes: "",
    tool_state: {},
  });
  if (error) throw new Error(error.message);
  revalidateFlow(clientId);
}

// Merge a patch into tasks.tool_state.
export async function updateToolState(taskId: string, patch: Record<string, unknown>, status?: string) {
  const supabase = await createClient();
  const { data: task, error: readErr } = await supabase
    .from("tasks")
    .select("tool_state, job_id")
    .eq("id", taskId)
    .single();
  if (readErr) throw new Error(readErr.message);
  const payload: Record<string, unknown> = { tool_state: { ...(task.tool_state ?? {}), ...patch } };
  if (status) payload.status = status;
  const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
  if (error) throw new Error(error.message);
  const { data: job } = await supabase.from("jobs").select("client_id").eq("id", task.job_id).single();
  revalidateFlow(job?.client_id);
}

// Undo for a deleted flow task: put the same row back.
export async function restoreTask(row: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert(row);
  if (error) throw new Error(error.message);
  revalidateFlow();
}

// ── Settings: package templates ─────────────────────────────────────────────

export async function addTemplateTask(pkg: PackageId, phase: PhaseId, title: string) {
  const supabase = await createClient();
  const name = title.trim();
  if (!name) return;
  const { data: last } = await supabase
    .from("flow_templates")
    .select("position")
    .eq("package", pkg)
    .eq("phase", phase)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("flow_templates")
    .insert({ package: pkg, phase, title: name, position: (last?.position ?? 0) + 1 });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/templates");
}

export async function updateTemplateTask(
  id: string,
  input: { title?: string; tool?: string | null; default_assignee_id?: string | null }
) {
  const supabase = await createClient();
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined && input.title.trim()) payload.title = input.title.trim();
  if (input.tool !== undefined) payload.tool = input.tool || null;
  if (input.default_assignee_id !== undefined) payload.default_assignee_id = input.default_assignee_id || null;
  if (!Object.keys(payload).length) return;
  const { error } = await supabase.from("flow_templates").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/templates");
}

export async function deleteTemplateTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("flow_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/templates");
}

export async function moveTemplateTask(id: string, dir: -1 | 1) {
  const supabase = await createClient();
  const { data: row } = await supabase.from("flow_templates").select("*").eq("id", id).single();
  if (!row) return;
  const { data: siblings } = await supabase
    .from("flow_templates")
    .select("id, position")
    .eq("package", row.package)
    .eq("phase", row.phase)
    .order("position");
  const list = siblings ?? [];
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((x, k) => supabase.from("flow_templates").update({ position: k + 1 }).eq("id", x.id)));
  revalidatePath("/settings/templates");
}

// ── Settings: pricing ───────────────────────────────────────────────────────

export async function addPricingTier() {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("pricing_tiers")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("pricing_tiers")
    .insert({ name: "New tier", amount: 0, position: (last?.position ?? 0) + 1 });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/pricing");
}

export async function updatePricingTier(
  id: string,
  input: { name?: string; amount?: number; cadence?: "month" | "once"; min_months?: number; is_from?: boolean; description?: string }
) {
  const supabase = await createClient();
  const payload: Record<string, unknown> = { ...input };
  if (typeof payload.name === "string") payload.name = (payload.name as string).trim() || "Untitled tier";
  if (input.cadence === "once") payload.min_months = 0;
  const { error } = await supabase.from("pricing_tiers").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/pricing");
}

export async function deletePricingTier(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pricing_tiers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/pricing");
}

// ── Past leads ──────────────────────────────────────────────────────────────

// Bring an archived discovery call back into Sales, with what we already know
// from the booking and the Gemini notes in the Discovery task.
export async function revivePastLead(clientId: string) {
  const supabase = await createClient();
  const { data: client, error } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (error) throw new Error(error.message);

  let leadId = client.lead_id as string | null;
  if (!leadId) {
    const { data: profiles } = await supabase.from("profiles").select("id, email, name");
    leadId = (profiles ?? []).find((p) => /^gizelle@/i.test(p.email) || /^gizelle/i.test(p.name))?.id ?? null;
  }
  await supabase.from("clients").update({ is_past_lead: false, package: client.package ?? "lead", lead_id: leadId }).eq("id", clientId);

  const { data: job } = await supabase.from("jobs").select("id").eq("client_id", clientId).eq("kind", "flow").maybeSingle();
  if (!job) await issueFlow(clientId, (client.package ?? "lead") as PackageId, leadId);

  const jobId = await getOrCreateFlowJob(supabase, clientId);
  const { data: disc } = await supabase.from("tasks").select("id, tool_state").eq("job_id", jobId).eq("tool", "discovery").maybeSingle();
  if (disc) {
    const ts = (disc.tool_state ?? {}) as Record<string, unknown>;
    await supabase
      .from("tasks")
      .update({
        tool_state: {
          ...ts,
          need: ts.need || client.call_message || "",
          transcript: ts.transcript || client.call_notes || "",
          link: ts.link || client.call_notes_url || "",
        },
      })
      .eq("id", disc.id);
  }
  revalidateFlow(clientId);
}
