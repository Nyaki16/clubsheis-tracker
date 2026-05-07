"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StageId } from "@/lib/constants";

export async function createJob(clientId: string, name: string, dueDate: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").insert({
    client_id: clientId,
    name,
    due_date: dueDate || null,
    stage: "briefing",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
}

export async function updateJobStage(id: string, stage: StageId) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ stage }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
}

export async function deleteJob(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  revalidatePath("/daily");
}
