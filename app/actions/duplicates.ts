"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pairKey } from "@/lib/duplicates";
import type { Client, Task } from "@/lib/types";

type SB = Awaited<ReturnType<typeof createClient>>;

async function requireAdmin(supabase: SB) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).single();
  if (!me?.is_admin) throw new Error("Only Tracker admins can merge clients.");
}

const hasData = (t: Pick<Task, "tool_state" | "notes" | "status">) =>
  Object.keys(t.tool_state ?? {}).length > 0 || !!t.notes?.trim() || t.status !== "planning";

// Fields copied from the duplicate only when the kept client has none.
const FILL = [
  "email", "phone", "business_name", "about", "profile_pic_url", "instagram_url", "tiktok_url", "facebook_url",
  "linkedin_url", "youtube_url", "website_url", "google_drive_url", "canva_brand_url", "client_profile_doc_url",
  "research_bible_doc_url", "brand_voice_doc_url", "strategy_brief_doc_url", "package", "lead_id", "clock_started_on",
] as const;
const CALL = ["call_event_id", "call_at", "call_title", "call_notes_url", "call_message", "call_notes", "call_cancelled"] as const;

/**
 * Merge `dropId` into `keepId`: fill the kept client's empty details, take the
 * later discovery call, move jobs, tasks and key dates across (combining the
 * two client flows if both have one), then delete the duplicate.
 */
export async function mergeClients(keepId: string, dropId: string) {
  if (keepId === dropId) throw new Error("Pick two different clients.");
  const supabase = await createClient();
  await requireAdmin(supabase);

  const [{ data: keep }, { data: drop }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", keepId).single(),
    supabase.from("clients").select("*").eq("id", dropId).single(),
  ]);
  if (!keep || !drop) throw new Error("One of these clients no longer exists. Refresh the page.");
  const k = keep as Client & Record<string, unknown>;
  const d = drop as Client & Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const f of FILL) if ((k[f] === null || k[f] === "") && d[f] !== null && d[f] !== "") patch[f] = d[f];
  const dropCallNewer = d.call_at && (!k.call_at || new Date(d.call_at) > new Date(k.call_at));
  if (dropCallNewer) for (const f of CALL) patch[f] = d[f];
  if (!k.client_flow_id && d.client_flow_id) patch.client_flow_id = d.client_flow_id;
  if (k.is_past_lead && !d.is_past_lead) patch.is_past_lead = false;
  if (k.package === "lead" && d.package && d.package !== "lead") patch.package = d.package;

  // Unique keys must leave the duplicate before the kept client can take them.
  const release: Record<string, null> = {};
  if (patch.call_event_id) release.call_event_id = null;
  if (patch.client_flow_id) release.client_flow_id = null;
  if (Object.keys(release).length) {
    const { error } = await supabase.from("clients").update(release).eq("id", dropId);
    if (error) throw new Error(error.message);
  }

  // Jobs: one client flow per client, so combine flows when both have one.
  const { data: keepFlowJob } = await supabase.from("jobs").select("id").eq("client_id", keepId).eq("kind", "flow").maybeSingle();
  const { data: dropFlowJob } = await supabase.from("jobs").select("id").eq("client_id", dropId).eq("kind", "flow").maybeSingle();

  if (dropFlowJob && keepFlowJob) {
    const [{ data: kt }, { data: dt }] = await Promise.all([
      supabase.from("tasks").select("*").eq("job_id", keepFlowJob.id),
      supabase.from("tasks").select("*").eq("job_id", dropFlowJob.id),
    ]);
    const keepTasks = (kt ?? []) as Task[];
    for (const t of (dt ?? []) as Task[]) {
      const same = keepTasks.find((x) => x.title === t.title);
      if (!same) {
        await supabase.from("tasks").update({ job_id: keepFlowJob.id }).eq("id", t.id);
      } else if (hasData(t) && !hasData(same)) {
        // The duplicate's copy has the work in it: keep that one instead.
        await supabase.from("tasks").update({ job_id: keepFlowJob.id }).eq("id", t.id);
        await supabase.from("tasks").delete().eq("id", same.id);
      }
    }
    await supabase.from("jobs").delete().eq("id", dropFlowJob.id);
  }
  // Every other job (and a lone flow) simply moves across.
  const { error: jobErr } = await supabase.from("jobs").update({ client_id: keepId }).eq("client_id", dropId);
  if (jobErr) throw new Error(jobErr.message);
  await supabase.from("client_dates").update({ client_id: keepId }).eq("client_id", dropId);
  // Debbie's meeting links and the client documents come across too.
  const { data: links } = await supabase.from("meeting_clients").select("meeting_id").eq("client_id", dropId);
  if (links?.length) {
    await supabase
      .from("meeting_clients")
      .upsert(links.map((l) => ({ meeting_id: l.meeting_id, client_id: keepId })), { onConflict: "meeting_id,client_id", ignoreDuplicates: true });
  }
  await supabase.from("client_documents").update({ client_id: keepId }).eq("client_id", dropId);
  if (d.profile_gdoc_id && !k.profile_gdoc_id) patch.profile_gdoc_id = d.profile_gdoc_id;
  if (d.strategy_gdoc_id && !k.strategy_gdoc_id) patch.strategy_gdoc_id = d.strategy_gdoc_id;

  if (Object.keys(patch).length) {
    const { error } = await supabase.from("clients").update(patch).eq("id", keepId);
    if (error) throw new Error(error.message);
  }
  const { error: delErr } = await supabase.from("clients").delete().eq("id", dropId);
  if (delErr) throw new Error(delErr.message);

  for (const p of ["/settings/duplicates", "/clients", `/clients/${keepId}`, "/home", "/calendar", "/daily"]) revalidatePath(p);
  return { name: k.name };
}

// "Not a duplicate": remember the pair so it stops showing.
export async function ignoreDuplicate(a: string, b: string) {
  const supabase = await createClient();
  await requireAdmin(supabase);
  const { data } = await supabase.from("app_settings").select("value").eq("key", "duplicates_ignored").maybeSingle();
  const pairs = new Set<string>(((data?.value as { pairs?: string[] } | undefined)?.pairs) ?? []);
  pairs.add(pairKey(a, b));
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "duplicates_ignored", value: { pairs: [...pairs] }, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/duplicates");
}
