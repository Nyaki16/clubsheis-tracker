"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StageId } from "@/lib/constants";
import type { Task } from "@/lib/types";
import { PHASES, SETUP_PHASES, isDone, packageLabel } from "@/lib/flow";
import { loadPackages } from "@/lib/packages";
import { changeClientPackage } from "./flow";

type SB = Awaited<ReturnType<typeof createClient>>;
const isSetup = (phase: string | null) => (SETUP_PHASES as readonly string[]).includes(phase ?? "");

/**
 * Has this client been through Sales and Onboarding? True when their 14-day
 * clock has started, real work in their flow is done, every Sales + Onboarding
 * task is done, or they're an existing client with jobs but no client flow.
 */
async function isOnboarded(supabase: SB, clientId: string) {
  const [{ data: client }, { data: jobs }] = await Promise.all([
    supabase.from("clients").select("clock_started_on").eq("id", clientId).single(),
    supabase.from("jobs").select("id, kind").eq("client_id", clientId),
  ]);
  if (client?.clock_started_on) return true;
  const flow = (jobs ?? []).find((j) => j.kind === "flow");
  if (!flow) return (jobs ?? []).length > 0;
  const { data } = await supabase.from("tasks").select("phase, status").eq("job_id", flow.id);
  const tasks = (data ?? []) as Pick<Task, "phase" | "status">[];
  if (tasks.some((t) => t.phase && !isSetup(t.phase) && isDone(t))) return true;
  const setup = tasks.filter((t) => t.phase === "sales" || t.phase === "onboarding");
  return setup.length > 0 && setup.every(isDone);
}

/**
 * New job, optionally from a package. A client who's already onboarded gets a
 * new job with just the package's Production + Delivery tasks (e.g. this
 * month's Silver cycle). A client who isn't yet starts their client flow on
 * that package instead, Sales through Delivery.
 */
export async function createJob(clientId: string, name: string, dueDate: string | null, packageId?: string | null) {
  const supabase = await createClient();
  if (packageId) await loadPackages(supabase);
  const label = packageId ? packageLabel(packageId) : "";

  if (packageId && !(await isOnboarded(supabase, clientId))) {
    const r = await changeClientPackage(clientId, packageId);
    return { message: `Not onboarded yet, so ${label} started their client flow from Sales (${r.added} tasks added)` };
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      client_id: clientId,
      name,
      due_date: dueDate || null,
      stage: "briefing",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  let added = 0;
  if (packageId && job?.id) {
    const [{ data: template }, { data: client }] = await Promise.all([
      supabase.from("flow_templates").select("phase, position, title, default_assignee_id").eq("package", packageId),
      supabase.from("clients").select("lead_id").eq("id", clientId).single(),
    ]);
    const order = (p: string) => PHASES.findIndex((x) => x.id === p);
    const rows = ((template ?? []) as { phase: string; position: number; title: string; default_assignee_id: string | null }[])
      .filter((t) => !isSetup(t.phase))
      .sort((a, b) => order(a.phase) - order(b.phase) || a.position - b.position)
      .map((t) => ({
        job_id: job.id,
        title: t.title,
        status: "planning" as const,
        notes: "",
        assignee_id: t.default_assignee_id ?? client?.lead_id ?? null,
      }));
    if (rows.length) {
      const { error: tasksError } = await supabase.from("tasks").insert(rows);
      if (tasksError) throw new Error(tasksError.message);
    }
    added = rows.length;
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  revalidatePath("/daily");
  return {
    message: packageId ? `${name}: ${added} ${label} tasks added (Sales and Onboarding skipped, they're already onboarded)` : `${name} created`,
  };
}

export async function updateJobStage(id: string, stage: StageId) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ stage }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
}

export async function deleteJob(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  revalidatePath("/daily");
}
