import { createClient } from "@/lib/supabase/server";
import { withoutArchived } from "@/lib/archived";
import DailyClient from "./daily-client";

export default async function DailyPage() {
  const supabase = await createClient();
  const [tasksRes, clientsRes, jobsRes, profilesRes] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("*").order("name"),
    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("name"),
  ]);

  // Archived clients (Past leads) and their tasks stay off the Daily Scroll.
  const clients = (clientsRes.data ?? []).filter((c) => !c.is_past_lead);
  const jobs = jobsRes.data ?? [];
  return (
    <DailyClient
      tasks={withoutArchived(tasksRes.data ?? [], jobs, clientsRes.data ?? [])}
      clients={clients}
      jobs={jobs}
      profiles={profilesRes.data ?? []}
    />
  );
}
