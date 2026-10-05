"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ghutteSettings, runGhutteSetup, tagProposalAccepted } from "@/lib/ghutte";
import type { Client } from "@/lib/types";

async function me() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  return { supabase, userId: auth.user.id };
}

const done = (clientId: string) => {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/home");
};

/**
 * Tick or untick Proposal Accepted. Ticking tags the client in ClubSheIs's GHL
 * (starting the workflow) and, if Ghutte is already paid, sets up Ghutte.
 * Returns a note for the toast; the tick stays even if GHL fails.
 */
export async function setProposalAccepted(clientId: string, accepted: boolean) {
  const { supabase, userId } = await me();
  // Only the click that actually ticks it carries on to GHL, so a double click
  // (or two people at once) can't start the workflow twice.
  let query = supabase
    .from("clients")
    .update(accepted ? { proposal_accepted_at: new Date().toISOString(), proposal_accepted_by: userId } : { proposal_accepted_at: null, proposal_accepted_by: null, ghutte_error: null })
    .eq("id", clientId);
  if (accepted) query = query.is("proposal_accepted_at", null);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (accepted && !data) return { note: "Already ticked." };
  if (!accepted) {
    done(clientId);
    return { note: "Proposal Accepted unticked. (The tag stays on their GHL contact.)" };
  }
  let note: string;
  try {
    const { tag } = await tagProposalAccepted(supabase, data as Client);
    note = `Proposal accepted. Tagged “${tag}” in GHL, so the workflow is running.`;
  } catch (e) {
    note = `Proposal accepted, but GHL wasn't updated: ${e instanceof Error ? e.message : "unknown error"}`;
    await supabase.from("clients").update({ ghutte_error: note }).eq("id", clientId);
  }
  if ((data as Client).ghutte_paid_at) note = `${note} ${await runGhutteSetup(supabase, clientId)}`.trim();
  done(clientId);
  return { note };
}

/** Tick or untick Ghutte Payment Made by hand (e.g. paid by EFT). */
export async function setGhuttePaid(clientId: string, paid: boolean) {
  const { supabase, userId } = await me();
  const { data, error } = await supabase
    .from("clients")
    .update(paid ? { ghutte_paid_at: new Date().toISOString(), ghutte_payment: { source: "ticked by hand", by: userId } } : { ghutte_paid_at: null, ghutte_payment: null, ghutte_error: null })
    .eq("id", clientId)
    .select("proposal_accepted_at")
    .single();
  if (error) throw new Error(error.message);
  let note = paid ? "Ghutte payment marked as made." : "Ghutte Payment Made unticked.";
  if (paid && data.proposal_accepted_at) note += ` ${await runGhutteSetup(supabase, clientId)}`;
  done(clientId);
  return { note };
}

export async function saveGhutteSettings(input: { tag: string }) {
  const { supabase } = await me();
  const current = await ghutteSettings(supabase);
  const tag = input.tag.trim();
  if (!tag) throw new Error("The tag can't be empty.");
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "ghutte", value: { ...current, tag }, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/ghutte");
}

/** The secret in the payment webhook's link; made once, or again to cut off an old link. */
export async function newGhutteWebhookSecret() {
  const { supabase } = await me();
  const current = await ghutteSettings(supabase);
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "ghutte", value: { ...current, webhookSecret: randomBytes(18).toString("base64url") }, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/ghutte");
}

