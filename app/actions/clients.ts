"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_COLORS } from "@/lib/constants";
import type { ClientProfileInput } from "@/lib/types";

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

export async function updateClient(id: string, input: Partial<ClientProfileInput>) {
  const supabase = await createClient();
  const payload: Record<string, unknown> = {};
  const keys: (keyof ClientProfileInput)[] = [
    "name",
    "business_name",
    "about",
    "profile_pic_url",
    "instagram_url",
    "tiktok_url",
    "facebook_url",
    "linkedin_url",
    "youtube_url",
    "website_url",
    "google_drive_url",
    "canva_brand_url",
  ];
  for (const k of keys) {
    if (input[k] !== undefined) {
      const v = input[k];
      payload[k] = typeof v === "string" && v.trim() === "" ? null : v;
    }
  }
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.from("clients").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
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
