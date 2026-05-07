"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskStatusId } from "@/lib/constants";

export type TaskInput = {
  title: string;
  assignee_id: string | null;
  due_date: string | null;
  notes: string;
  status: TaskStatusId;
};

export async function createTask(jobId: string, input: TaskInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    job_id: jobId,
    title: input.title,
    assignee_id: input.assignee_id,
    due_date: input.due_date || null,
    notes: input.notes ?? "",
    status: input.status,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/daily");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/clients");
}

export async function updateTask(id: string, updates: Partial<TaskInput>) {
  const supabase = await createClient();
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.assignee_id !== undefined) payload.assignee_id = updates.assignee_id;
  if (updates.due_date !== undefined) payload.due_date = updates.due_date || null;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.status !== undefined) payload.status = updates.status;

  const { error } = await supabase.from("tasks").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/daily");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/clients");
}

export async function updateTaskStatus(id: string, status: TaskStatusId) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/daily");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/clients");
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/daily");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/clients");
}

export type BulkUpdates = {
  assignee_id?: string | null;
  due_date?: string | null;
  status?: TaskStatusId;
};

export async function bulkUpdateTasks(ids: string[], updates: BulkUpdates) {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const payload: Record<string, unknown> = {};
  if (updates.assignee_id !== undefined) payload.assignee_id = updates.assignee_id;
  if (updates.due_date !== undefined) payload.due_date = updates.due_date || null;
  if (updates.status !== undefined) payload.status = updates.status;
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.from("tasks").update(payload).in("id", ids);
  if (error) throw new Error(error.message);

  revalidatePath("/daily");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/clients");
}

export async function bulkDeleteTasks(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().in("id", ids);
  if (error) throw new Error(error.message);

  revalidatePath("/daily");
  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/clients");
}
