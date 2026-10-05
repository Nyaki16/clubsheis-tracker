"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentPhase, type PhaseId } from "@/lib/flow";
import type { Task } from "@/lib/types";

type SB = Awaited<ReturnType<typeof createClient>>;

async function me() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  return { supabase, userId: auth.user.id };
}

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/home");
  revalidatePath("/daily");
}

export async function updateBrief(id: string, input: { title: string; content: string }) {
  const { supabase, userId } = await me();
  if (!input.title.trim()) throw new Error("The brief needs a name.");
  if (!input.content.trim()) throw new Error("The brief can't be empty.");
  const { data, error } = await supabase
    .from("project_briefs")
    .update({ title: input.title.trim(), content: input.content.trim(), updated_by: userId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("client_id")
    .single();
  if (error) throw new Error(error.message);
  revalidate(data.client_id);
}

export async function deleteBrief(id: string) {
  const { supabase } = await me();
  const { data, error } = await supabase.from("project_briefs").delete().eq("id", id).select("client_id").single();
  if (error) throw new Error(error.message);
  revalidate(data.client_id);
}

/** For the task drawer: the brief a task was sent from. */
export async function getBrief(id: string) {
  const { supabase } = await me();
  const { data } = await supabase.from("project_briefs").select("id, client_id, title, content, updated_at").eq("id", id).maybeSingle();
  return data as { id: string; client_id: string; title: string; content: string; updated_at: string } | null;
}

// Client work lives in the client's flow, in the phase they're in now. A client
// without a flow gets a "Project briefs" job instead.
async function taskHome(supabase: SB, clientId: string, phase: PhaseId | null) {
  const { data: flow } = await supabase.from("jobs").select("id").eq("client_id", clientId).eq("kind", "flow").maybeSingle();
  if (flow) {
    const { data: rows } = await supabase.from("tasks").select("phase, status, position, created_at").eq("job_id", flow.id);
    const tasks = (rows ?? []) as Pick<Task, "phase" | "status" | "position" | "created_at">[];
    const ph = phase ?? currentPhase(tasks) ?? "production";
    const last = Math.max(0, ...tasks.filter((t) => t.phase === ph).map((t) => t.position ?? 0));
    return { jobId: flow.id as string, phase: ph, position: last + 1 };
  }
  const { data: job } = await supabase.from("jobs").select("id").eq("client_id", clientId).eq("name", "Project briefs").maybeSingle();
  if (job) return { jobId: job.id as string, phase: null, position: null };
  const { data: made, error } = await supabase
    .from("jobs")
    .insert({ client_id: clientId, name: "Project briefs", kind: "job", stage: "briefing" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { jobId: made.id as string, phase: null, position: null };
}

/** Send a brief to a team member as a task. The brief stays on the client. */
export async function sendBriefAsTask(briefId: string, input: { assigneeId: string; dueDate: string | null; phase: PhaseId | null }) {
  const { supabase, userId } = await me();
  if (!input.assigneeId) throw new Error("Pick who it's for.");
  const { data: brief, error: bErr } = await supabase.from("project_briefs").select("id, client_id, title").eq("id", briefId).single();
  if (bErr) throw new Error(bErr.message);
  const home = await taskHome(supabase, brief.client_id, input.phase);
  const { error } = await supabase.from("tasks").insert({
    job_id: home.jobId,
    phase: home.phase,
    position: home.position,
    title: brief.title,
    notes: "Work from the project brief attached to this task (it's also on the client's page under Project Briefs).",
    status: "planning",
    assignee_id: input.assigneeId,
    originator_id: userId,
    due_date: input.dueDate || null,
    brief_id: brief.id,
    tool_state: {},
  });
  if (error) throw new Error(error.message);
  revalidate(brief.client_id);
}
