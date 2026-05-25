import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchClientFlowDocs } from "@/lib/client-flow";
import type { Client, Job, Profile, Task } from "@/lib/types";
import ClientDetail from "./client-detail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const [jobsRes, tasksRes, profilesRes, clientFlowDocs] = await Promise.all([
    supabase
      .from("jobs")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("name"),
    fetchClientFlowDocs(client.name),
  ]);

  const jobs: Job[] = jobsRes.data ?? [];
  const allTasks: Task[] = tasksRes.data ?? [];
  const jobIds = new Set(jobs.map((j) => j.id));
  const tasks = allTasks.filter((t) => jobIds.has(t.job_id));
  const profiles: Profile[] = profilesRes.data ?? [];

  return (
    <ClientDetail
      client={client as Client}
      jobs={jobs}
      tasks={tasks}
      profiles={profiles}
      clientFlowDocs={clientFlowDocs}
    />
  );
}
