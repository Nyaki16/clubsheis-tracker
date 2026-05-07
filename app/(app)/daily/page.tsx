import { createClient } from "@/lib/supabase/server";
import DailyClient from "./daily-client";

export default async function DailyPage() {
  const supabase = await createClient();
  const [tasksRes, clientsRes, jobsRes, profilesRes] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("*").order("name"),
    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("name"),
  ]);

  return (
    <DailyClient
      tasks={tasksRes.data ?? []}
      clients={clientsRes.data ?? []}
      jobs={jobsRes.data ?? []}
      profiles={profilesRes.data ?? []}
    />
  );
}
