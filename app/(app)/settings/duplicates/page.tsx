import { createClient } from "@/lib/supabase/server";
import { findDuplicates, type ClientStats } from "@/lib/duplicates";
import type { Client } from "@/lib/types";
import DuplicatesList from "./duplicates-list";

export default async function DuplicatesPage() {
  const supabase = await createClient();
  const [clientsRes, jobsRes, datesRes, ignoredRes] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("jobs").select("id, client_id, kind"),
    supabase.from("client_dates").select("client_id"),
    supabase.from("app_settings").select("value").eq("key", "duplicates_ignored").maybeSingle(),
  ]);
  const jobs = jobsRes.data ?? [];
  const flowJobIds = jobs.filter((j) => j.kind === "flow").map((j) => j.id);
  const { data: tasks } = flowJobIds.length
    ? await supabase.from("tasks").select("job_id, status").in("job_id", flowJobIds)
    : { data: [] as { job_id: string; status: string }[] };

  const stats: Record<string, ClientStats & { flowDone: number }> = {};
  const s = (id: string) => (stats[id] ??= { flowTasks: 0, jobs: 0, dates: 0, flowDone: 0 });
  const jobClient = new Map(jobs.map((j) => [j.id, j.client_id]));
  for (const j of jobs) if (j.kind !== "flow") s(j.client_id).jobs++;
  for (const t of tasks ?? []) {
    const cid = jobClient.get(t.job_id);
    if (!cid) continue;
    s(cid).flowTasks++;
    if (t.status === "closed_out" || t.status === "published") s(cid).flowDone++;
  }
  for (const d of datesRes.data ?? []) s(d.client_id).dates++;

  const ignored = new Set<string>(((ignoredRes.data?.value as { pairs?: string[] } | undefined)?.pairs) ?? []);
  const pairs = findDuplicates((clientsRes.data ?? []) as Client[], stats, ignored);
  return <DuplicatesList pairs={pairs} stats={stats} />;
}
