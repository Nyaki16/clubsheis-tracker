"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClientDateInput } from "@/lib/types";

function clean(input: ClientDateInput) {
  return {
    title: input.title.trim(),
    date: input.date,
    notes: input.notes?.trim() ?? "",
  };
}

export async function createClientDate(clientId: string, input: ClientDateInput) {
  const c = clean(input);
  if (!c.title) throw new Error("Title is required.");
  if (!c.date) throw new Error("Date is required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_dates")
    .insert({ client_id: clientId, ...c });
  if (error) throw new Error(error.message);

  revalidatePath("/calendar");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function updateClientDate(id: string, input: ClientDateInput) {
  const c = clean(input);
  if (!c.title) throw new Error("Title is required.");
  if (!c.date) throw new Error("Date is required.");

  const supabase = await createClient();
  const { error } = await supabase.from("client_dates").update(c).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/calendar");
  revalidatePath("/clients");
}

export async function deleteClientDate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("client_dates").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/calendar");
  revalidatePath("/clients");
}
