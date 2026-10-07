import { createClient } from "@/lib/supabase/server";
import type { Client, Job, Profile, Task } from "@/lib/types";
import { withoutArchived } from "@/lib/archived";
import PipelineBoard from "./pipeline-board";

export default async function PipelinePage() {
  const supabase = await createClient();
  const [tasksRes, jobsRes, clientsRes, profilesRes] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: true }),
    supabase.from("jobs").select("*"),
    supabase.from("clients").select("*"),
    supabase.from("profiles").select("*").order("name"),
  ]);

  return (
    <PipelineBoard
      tasks={withoutArchived((tasksRes.data ?? []) as Task[], (jobsRes.data ?? []) as Job[], (clientsRes.data ?? []) as Client[])}
      jobs={(jobsRes.data ?? []) as Job[]}
      clients={(clientsRes.data ?? []) as Client[]}
      profiles={(profilesRes.data ?? []) as Profile[]}
    />
  );
}
