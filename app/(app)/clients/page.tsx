import { createClient } from "@/lib/supabase/server";
import ClientsList from "./clients-list";

export default async function ClientsPage() {
  const supabase = await createClient();
  const [clientsRes, jobsRes] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("jobs").select("*"),
  ]);

  return (
    <ClientsList
      clients={clientsRes.data ?? []}
      jobs={jobsRes.data ?? []}
    />
  );
}
