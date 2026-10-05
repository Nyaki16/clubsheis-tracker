"use server";

import { createClient } from "@/lib/supabase/server";
import type { PricingTier } from "@/lib/flow";
import type { Client, Task } from "@/lib/types";

/** What the task panel needs when a task is opened outside its client's page. */
export async function getTaskContext(taskId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!task) throw new Error("That task no longer exists.");
  const { data: job } = await supabase.from("jobs").select("client_id").eq("id", task.job_id).single();
  if (!job) throw new Error("That task's job no longer exists.");
  // The flow's tasks too, so tools that read other tasks (proposal, Yellow Sheet) work.
  const { data: jobs } = await supabase.from("jobs").select("id").eq("client_id", job.client_id);
  const [{ data: client }, { data: siblings }, { data: tiers }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", job.client_id).single(),
    supabase.from("tasks").select("*").in("job_id", (jobs ?? []).map((j) => j.id)),
    supabase.from("pricing_tiers").select("*").order("position"),
  ]);
  if (!client) throw new Error("That task's client no longer exists.");
  return { client: client as Client, clientTasks: (siblings ?? []) as Task[], tiers: (tiers ?? []) as PricingTier[] };
}
