"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeWeeklyBriefing } from "@/lib/briefing";

async function me() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).single();
  return { supabase, isAdmin: !!profile?.is_admin };
}

/** The monthly new-client target. Admins only. */
export async function setNewClientTarget(n: number) {
  const { supabase, isAdmin } = await me();
  if (!isAdmin) throw new Error("Only Tracker admins can change the target.");
  if (!Number.isFinite(n) || n < 1 || n > 500) throw new Error("Pick a target between 1 and 500.");
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "targets", value: { newClientsPerMonth: Math.round(n) }, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function writeBriefingNow() {
  const { supabase } = await me();
  await writeWeeklyBriefing(supabase);
  revalidatePath("/dashboard");
}
