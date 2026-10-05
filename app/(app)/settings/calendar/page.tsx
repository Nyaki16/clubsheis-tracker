import { createClient } from "@/lib/supabase/server";
import CalendarSetup from "./calendar-setup";

export default async function CalendarSettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", "calendar_sync").maybeSingle();
  return (
    <CalendarSetup
      lastSync={(data?.value as Record<string, unknown> | undefined) ?? null}
      migrated={!error}
      secretSet={!!process.env.CALENDAR_SYNC_SECRET}
    />
  );
}
