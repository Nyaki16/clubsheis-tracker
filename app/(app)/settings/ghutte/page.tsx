import { createClient } from "@/lib/supabase/server";
import { ghutteSettings } from "@/lib/ghutte";
import { PUBLIC_APP_URL } from "@/lib/email";
import GhutteSetup from "./ghutte-setup";

export default async function GhutteSettingsPage() {
  const supabase = await createClient();
  const [settings, { data: unmatched }] = await Promise.all([
    ghutteSettings(supabase),
    supabase.from("app_settings").select("value").eq("key", "ghl_unmatched_payments").maybeSingle(),
  ]);
  return (
    <GhutteSetup
      settings={settings}
      webhookUrl={settings.webhookSecret ? `${PUBLIC_APP_URL}/api/ghl/payment?key=${settings.webhookSecret}` : ""}
      env={{
        clubsheisKey: !!process.env.GHL_PIT_KEY_CLUBSHEIS,
        agencyKey: !!process.env.GHL_AGENCY_KEY,
        gmail: !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD,
      }}
      unmatched={(((unmatched?.value ?? {}) as { items?: Record<string, string | null>[] }).items ?? []).slice(0, 10)}
    />
  );
}
