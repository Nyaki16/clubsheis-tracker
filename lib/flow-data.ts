import type { createClient } from "@/lib/supabase/server";
import type { Client, Job, Profile, Task } from "./types";
import type { FlowTemplate, PricingTier } from "./flow";

type SB = Awaited<ReturnType<typeof createClient>>;

// Everything the flow screens need in one round of queries.
export async function loadFlowData(supabase: SB) {
  const [clientsRes, jobsRes, profilesRes, templatesRes, userRes] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("jobs").select("*").eq("kind", "flow"),
    supabase.from("profiles").select("*").order("name"),
    supabase.from("flow_templates").select("*").order("position"),
    supabase.auth.getUser(),
  ]);
  const flowJobs = (jobsRes.data ?? []) as Job[];
  const jobIds = flowJobs.map((j) => j.id);
  const tasksRes = jobIds.length
    ? await supabase.from("tasks").select("*").in("job_id", jobIds)
    : { data: [] as Task[] };

  const jobClient = new Map(flowJobs.map((j) => [j.id, j.client_id]));
  const tasksByClient = new Map<string, Task[]>();
  for (const t of (tasksRes.data ?? []) as Task[]) {
    const cid = jobClient.get(t.job_id);
    if (!cid) continue;
    if (!tasksByClient.has(cid)) tasksByClient.set(cid, []);
    tasksByClient.get(cid)!.push(t);
  }

  return {
    clients: (clientsRes.data ?? []) as Client[],
    profiles: (profilesRes.data ?? []) as Profile[],
    templates: (templatesRes.data ?? []) as FlowTemplate[],
    tasksByClient: Object.fromEntries(tasksByClient) as Record<string, Task[]>,
    meId: userRes.data.user?.id ?? null,
    migrated: !templatesRes.error,
  };
}

export async function loadPricing(supabase: SB) {
  const { data } = await supabase.from("pricing_tiers").select("*").order("position");
  return (data ?? []) as PricingTier[];
}
