import { createClient } from "@/lib/supabase/server";
import type { Client, Job, Task } from "@/lib/types";
import PipelineBoard from "./pipeline-board";

export default async function PipelinePage() {
  const supabase = await createClient();
  const [tasksRes, jobsRes, clientsRes] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: true }),
    supabase.from("jobs").select("*"),
    supabase.from("clients").select("*"),
  ]);

  return (
    <PipelineBoard
      tasks={(tasksRes.data ?? []) as Task[]}
      jobs={(jobsRes.data ?? []) as Job[]}
      clients={(clientsRes.data ?? []) as Client[]}
    />
  );
}
