"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function me() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  return { supabase, userId: auth.user.id };
}

// New or changed meeting notes queue a refresh of the client's documents.
async function queueRefresh(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string) {
  await supabase.from("clients").update({ docs_dirty_at: new Date().toISOString() }).eq("id", clientId);
  revalidatePath(`/clients/${clientId}`);
}

export type MeetingInput = { title: string; starts_at: string | null; notes: string };

export async function addMeeting(clientId: string, input: MeetingInput) {
  const { supabase, userId } = await me();
  if (!input.notes.trim()) throw new Error("Add the meeting notes.");
  const { data: m, error } = await supabase
    .from("meetings")
    .insert({
      title: input.title.trim() || "Meeting",
      starts_at: input.starts_at || new Date().toISOString(),
      kind: "client",
      notes: input.notes.trim(),
      source: "manual",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: linkErr } = await supabase.from("meeting_clients").insert({ meeting_id: m.id, client_id: clientId });
  if (linkErr) throw new Error(linkErr.message);
  await queueRefresh(supabase, clientId);
}

async function linkedClients(supabase: Awaited<ReturnType<typeof createClient>>, meetingId: string) {
  const { data } = await supabase.from("meeting_clients").select("client_id").eq("meeting_id", meetingId);
  return (data ?? []).map((r) => r.client_id as string);
}

export async function updateMeeting(id: string, input: MeetingInput) {
  const { supabase } = await me();
  const { error } = await supabase
    .from("meetings")
    .update({ title: input.title.trim() || "Meeting", starts_at: input.starts_at, notes: input.notes.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("source", "manual");
  if (error) throw new Error(error.message);
  for (const c of await linkedClients(supabase, id)) await queueRefresh(supabase, c);
}

export async function deleteMeeting(id: string) {
  const { supabase } = await me();
  const clients = await linkedClients(supabase, id);
  const { error } = await supabase.from("meetings").delete().eq("id", id).eq("source", "manual");
  if (error) throw new Error(error.message);
  for (const c of clients) await queueRefresh(supabase, c);
}

// A team edit becomes the newest version; the AI builds on it next time.
export async function saveDocEdit(clientId: string, kind: "profile" | "strategy", content: string) {
  const { supabase, userId } = await me();
  if (!content.trim()) throw new Error("The document can't be empty.");
  const { data: who } = await supabase.from("profiles").select("name").eq("id", userId).single();
  const { error } = await supabase
    .from("client_documents")
    .insert({ client_id: clientId, kind, content: content.trim(), created_by: userId, sources: `Edited by ${who?.name ?? "the team"}` });
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}

/** A task's client gets fresh documents on the next background run (e.g. a Yellow Sheet the team marked as received). */
export async function queueDocsForTask(taskId: string) {
  const { supabase } = await me();
  const { data: task } = await supabase.from("tasks").select("job_id").eq("id", taskId).single();
  if (!task) return;
  const { data: job } = await supabase.from("jobs").select("client_id").eq("id", task.job_id).single();
  if (job?.client_id) await queueRefresh(supabase, job.client_id);
}
