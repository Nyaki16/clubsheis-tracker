"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DeliverableStatusId } from "@/lib/constants";

export async function createDeliverable(jobId: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("deliverables").insert({
    job_id: jobId,
    name,
    status: "in_progress",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath("/dashboard");
}

export async function updateDeliverableStatus(id: string, status: DeliverableStatusId) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("deliverables")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath("/dashboard");
}
