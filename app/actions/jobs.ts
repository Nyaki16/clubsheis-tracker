"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StageId } from "@/lib/constants";
import { getJobTemplate } from "@/lib/job-templates";

export async function createJob(
  clientId: string,
  name: string,
  dueDate: string | null,
  templateId?: string | null
) {
  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      client_id: clientId,
      name,
      due_date: dueDate || null,
      stage: "briefing",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const template = getJobTemplate(templateId);
  if (template && job?.id) {
    const rows = template.tasks.map((title) => ({
      job_id: job.id,
      title,
      status: "planning" as const,
      notes: "",
    }));
    const { error: tasksError } = await supabase.from("tasks").insert(rows);
    if (tasksError) throw new Error(tasksError.message);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  revalidatePath("/daily");
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
