"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AssetInput, SopInput, VaultLinkInput } from "@/lib/types";

const HOME = "/csi-home";

// ── Assets ────────────────────────────────────────────────────────────────

function cleanAsset(input: AssetInput) {
  const trim = (v: string | null | undefined) =>
    v && v.trim() ? v.trim() : null;
  return {
    name: input.name.trim(),
    category: (input.category ?? "other").trim() || "other",
    serial: (input.serial ?? "").trim(),
    assigned_to: input.assigned_to ?? null,
    purchased_on: input.purchased_on || null,
    notes: (input.notes ?? "").trim(),
    model: trim(input.model),
    processor: trim(input.processor),
    memory: trim(input.memory),
    os: trim(input.os),
    graphics: trim(input.graphics),
  };
}

export async function createAsset(input: AssetInput) {
  const c = cleanAsset(input);
  if (!c.name) throw new Error("Name is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("assets").insert(c);
  if (error) throw new Error(error.message);
  revalidatePath(HOME);
}

export async function updateAsset(id: string, input: AssetInput) {
  const c = cleanAsset(input);
  if (!c.name) throw new Error("Name is required.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({ ...c, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(HOME);
}

export async function deleteAsset(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(HOME);
}

// ── SOPs ──────────────────────────────────────────────────────────────────

function cleanSop(input: SopInput) {
  const url = (input.url ?? "").trim();
  return {
    title: input.title.trim(),
    category: (input.category ?? "").trim(),
    body: input.body ?? "",
    url: url || null,
  };
}

export async function createSop(input: SopInput) {
  const c = cleanSop(input);
  if (!c.title) throw new Error("Title is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("sops").insert(c);
  if (error) throw new Error(error.message);
  revalidatePath(HOME);
}

export async function updateSop(id: string, input: SopInput) {
  const c = cleanSop(input);
  if (!c.title) throw new Error("Title is required.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("sops")
    .update({ ...c, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(HOME);
}

export async function deleteSop(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("sops").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(HOME);
}

// ── Vault links ──────────────────────────────────────────────────────────

function cleanVaultLink(input: VaultLinkInput) {
  const trim = (v: string | null | undefined) => {
    if (v === undefined) return undefined;
    return v && v.trim() ? v.trim() : null;
  };
  return {
    label: input.label.trim(),
    username: trim(input.username),
    // Password kept verbatim — no .trim() so leading/trailing spaces are
    // preserved if they're part of the credential. Empty → null.
    password: input.password ? input.password : input.password === "" ? null : input.password,
    url: trim(input.url),
    notes: (input.notes ?? "").trim(),
  };
}

export async function createVaultLink(input: VaultLinkInput) {
  const c = cleanVaultLink(input);
  if (!c.label) throw new Error("Label is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("vault_links").insert(c);
  if (error) throw new Error(error.message);
  revalidatePath(HOME);
}

export async function updateVaultLink(id: string, input: VaultLinkInput) {
  const c = cleanVaultLink(input);
  if (!c.label) throw new Error("Label is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("vault_links").update(c).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(HOME);
}

export async function deleteVaultLink(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("vault_links").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(HOME);
}
