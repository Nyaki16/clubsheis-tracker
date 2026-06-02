import { createClient } from "@/lib/supabase/server";
import type { Client, ClientDate } from "@/lib/types";
import CalendarBoard from "./calendar-board";

export default async function CalendarPage() {
  const supabase = await createClient();
  const [datesRes, clientsRes] = await Promise.all([
    supabase.from("client_dates").select("*").order("date", { ascending: true }),
    supabase.from("clients").select("*").order("name"),
  ]);

  return (
    <CalendarBoard
      dates={(datesRes.data ?? []) as ClientDate[]}
      clients={(clientsRes.data ?? []) as Client[]}
    />
  );
}
