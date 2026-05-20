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

/**
 * Toggle a task in/out of its assignee's Top 3.
 *
 * - If the task is already ranked: clears the rank.
 * - Otherwise: assigns the lowest free rank (1, 2, or 3) for the assignee.
 *
 * Throws a user-readable message if the task is unassigned or the assignee
 * already has three ranked tasks. The DB-level partial unique index on
 * (assignee_id, priority_rank) is the source of truth for the hard cap.
 */
export async function toggleTaskPriority(id: string) {
  const supabase = await createClient();

  const { data: task, error: fetchErr } = await supabase
    .from("tasks")
    .select("id, assignee_id, priority_rank")
    .eq("id", id)
    .single();
  if (fetchErr || !task) {
    throw new Error(fetchErr?.message ?? "Task not found");
  }

  if (task.priority_rank !== null) {
    const { error } = await supabase
      .from("tasks")
      .update({ priority_rank: null })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    if (!task.assignee_id) {
      throw new Error("Assign this task to someone before marking it as Top 3.");
    }

    const { data: existing, error: listErr } = await supabase
      .from("tasks")
      .select("priority_rank")
      .eq("assignee_id", task.assignee_id)
      .not("priority_rank", "is", null);
    if (listErr) throw new Error(listErr.message);

    const taken = new Set((existing ?? []).map((t) => t.priority_rank));
    const nextRank = [1, 2, 3].find((r) => !taken.has(r));
    if (!nextRank) {
      throw new Error("Top 3 is full — unstar one of the priorities first.");
    }

    const { error } = await supabase
      .from("tasks")
      .update({ priority_rank: nextRank })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

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
