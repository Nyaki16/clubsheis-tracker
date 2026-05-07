"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_COLORS } from "@/lib/constants";

export async function createClientRow(name: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true });
  const color = CLIENT_COLORS[(count ?? 0) % CLIENT_COLORS.length];

  const { error } = await supabase.from("clients").insert({ name, color });
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/daily");
  revalidatePath("/pipeline");
}

export async function deleteClient(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/daily");
  revalidatePath("/pipeline");
}
