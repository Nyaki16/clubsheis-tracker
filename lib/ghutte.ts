// Ghutte (GoHighLevel) automation. Server-only.
//
// 1. Proposal Accepted: the client's contact in ClubSheIs's own GHL account is
//    created or updated and tagged (default "ghuttegoodfit"), which starts the
//    team's workflow in GHL.
// 2. Ghutte Payment Made: GHL's payment workflow calls /api/ghl/payment, which
//    ticks the milestone (the team can also tick it by hand).
// 3. Once both are done: Mpume gets the "Create Ghutte sub-account" task for
//    today. She creates the sub-account, adds the client as a user and sends
//    their login in Ghutte by hand.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Task } from "./types";

const GHL_API = "https://services.leadconnectorhq.com";
const CLUBSHEIS_LOCATION = process.env.GHL_LOCATION_ID_CLUBSHEIS || "AkhI3DXZ01YFKLGXfg2V";

export type GhutteSettings = { tag: string; webhookSecret: string };

export async function ghutteSettings(sb: SupabaseClient): Promise<GhutteSettings> {
  const { data } = await sb.from("app_settings").select("value").eq("key", "ghutte").maybeSingle();
  const v = (data?.value ?? {}) as Partial<GhutteSettings>;
  return { tag: v.tag || "ghuttegoodfit", webhookSecret: v.webhookSecret || "" };
}

async function ghl<T>(path: string, key: string, init: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${GHL_API}${path}`, {
    method: init.method,
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${key}`, Version: "2021-07-28" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Ghutte said no (${res.status}): ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

const digits = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-9);

// ── 1. Proposal Accepted → tag in ClubSheIs's GHL ─────────────────────────────

export async function tagProposalAccepted(sb: SupabaseClient, client: Client) {
  const key = process.env.GHL_PIT_KEY_CLUBSHEIS;
  if (!key) throw new Error("GHL_PIT_KEY_CLUBSHEIS isn't set on the Tracker, so the GHL workflow can't be started. See Settings → Ghutte.");
  if (!client.email && !client.phone) throw new Error(`Add ${client.name}'s email or phone first, so GHL can find their contact.`);
  const { tag } = await ghutteSettings(sb);
  const { firstName, lastName } = splitName(client.name);
  const res = await ghl<{ contact?: { id: string; tags?: string[] } }>("/contacts/upsert", key, {
    method: "POST",
    body: {
      locationId: CLUBSHEIS_LOCATION,
      firstName,
      lastName,
      name: client.name,
      ...(client.email ? { email: client.email } : {}),
      ...(client.phone ? { phone: client.phone } : {}),
      ...(client.business_name ? { companyName: client.business_name } : {}),
      source: "ClubSheIs Tracker",
    },
  });
  const contactId = res.contact?.id;
  if (!contactId) throw new Error("GHL didn't return the contact.");
  // Tagging again doesn't help and could start the workflow twice.
  const has = (res.contact?.tags ?? []).some((t) => t.toLowerCase() === tag.toLowerCase());
  if (!has) await ghl(`/contacts/${contactId}/tags`, key, { method: "POST", body: { tags: [tag] } });
  await sb.from("clients").update({ ghl_contact_id: contactId }).eq("id", client.id);
  return { contactId, tag };
}

// ── 2. Payment webhook → which client paid? ──────────────────────────────────

export async function matchPayingClient(sb: SupabaseClient, p: { contactId?: string; email?: string; phone?: string }) {
  if (p.contactId) {
    const { data } = await sb.from("clients").select("*").eq("ghl_contact_id", p.contactId).limit(1).maybeSingle();
    if (data) return data as Client;
  }
  if (p.email) {
    const { data } = await sb.from("clients").select("*").ilike("email", p.email.trim()).order("is_past_lead").limit(1).maybeSingle();
    if (data) return data as Client;
  }
  const want = digits(p.phone);
  if (want.length === 9) {
    const { data } = await sb.from("clients").select("*").not("phone", "is", null);
    const hit = ((data ?? []) as Client[]).filter((c) => digits(c.phone) === want);
    if (hit.length === 1) return hit[0];
  }
  return null;
}

// ── 3. Ghutte setup (by hand, on Mpume's list) ───────────────────────────────

/**
 * Put "Create Ghutte sub-account" on Mpume's list for today, using the task
 * from the client's package if there is one.
 */
async function requestSubAccount(sb: SupabaseClient, client: Client) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: mpume } = await sb.from("profiles").select("id").ilike("name", "mpume%").limit(1).maybeSingle();
  let { data: flow } = await sb.from("jobs").select("id").eq("client_id", client.id).eq("kind", "flow").maybeSingle();
  if (!flow) {
    const { data } = await sb.from("jobs").insert({ client_id: client.id, name: "Client flow", kind: "flow", stage: "briefing" }).select("id").single();
    flow = data;
  }
  if (!flow) throw new Error("Couldn't find the client's flow to add Mpume's task.");
  const { data: rows } = await sb.from("tasks").select("id, assignee_id, status").eq("job_id", flow.id).eq("tool", "account");
  const open = ((rows ?? []) as Pick<Task, "id" | "assignee_id" | "status">[]).find((t) => t.status !== "closed_out" && t.status !== "published");
  if (open) {
    await sb.from("tasks").update({ due_date: today, assignee_id: open.assignee_id ?? mpume?.id ?? null }).eq("id", open.id);
    return;
  }
  if ((rows ?? []).length) return; // Already done.
  await sb.from("tasks").insert({
    job_id: flow.id,
    phase: "onboarding",
    position: 0,
    title: "Create Ghutte sub-account",
    tool: "account",
    tool_state: {},
    status: "planning",
    assignee_id: mpume?.id ?? client.lead_id ?? null,
    due_date: today,
    notes: "",
  });
}

/** Once both milestones are ticked, put the Ghutte setup on Mpume's list. */
export async function runGhutteSetup(sb: SupabaseClient, clientId: string): Promise<string> {
  const { data } = await sb.from("clients").select("*").eq("id", clientId).single();
  const client = data as Client | null;
  if (!client) return "Client not found.";
  if (!client.proposal_accepted_at || !client.ghutte_paid_at) return "";
  try {
    await requestSubAccount(sb, client);
    await sb.from("clients").update({ ghutte_error: null }).eq("id", clientId);
    return "Mpume has the “Create Ghutte sub-account” task for today.";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't add Mpume's task.";
    await sb.from("clients").update({ ghutte_error: msg }).eq("id", clientId);
    return msg;
  }
}
