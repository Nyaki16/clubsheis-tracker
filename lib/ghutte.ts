// Ghutte (GoHighLevel) automation. Server-only.
//
// 1. Proposal Accepted: the client's contact in ClubSheIs's own GHL account is
//    created or updated and tagged (default "ghuttegoodfit"), which starts the
//    team's workflow in GHL.
// 2. Ghutte Payment Made: GHL's payment workflow calls /api/ghl/payment, which
//    ticks the milestone (the team can also tick it by hand).
// 3. Once both are done: Mpume gets the "Create Ghutte sub-account" task (GHL
//    doesn't let our agency create sub-accounts through the API). She creates
//    it in GHL and links it in the Tracker, which then adds the client as a
//    user with a temporary password and emails them the login from Gizelle.
import { randomInt } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Task } from "./types";
import { CLIENT_SENDER } from "./sender";
import { emailHtml, sendGmail } from "./email";

const GHL_API = "https://services.leadconnectorhq.com";
const CLUBSHEIS_LOCATION = process.env.GHL_LOCATION_ID_CLUBSHEIS || "AkhI3DXZ01YFKLGXfg2V";

export type GhutteSettings = { tag: string; loginUrl: string; webhookSecret: string };

export async function ghutteSettings(sb: SupabaseClient): Promise<GhutteSettings> {
  const { data } = await sb.from("app_settings").select("value").eq("key", "ghutte").maybeSingle();
  const v = (data?.value ?? {}) as Partial<GhutteSettings>;
  return { tag: v.tag || "ghuttegoodfit", loginUrl: v.loginUrl || "", webhookSecret: v.webhookSecret || "" };
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

/** The client's own details from their Yellow Sheet, when they've sent it. */
async function yellowSheet(sb: SupabaseClient, clientId: string) {
  const { data: flow } = await sb.from("jobs").select("id").eq("client_id", clientId).eq("kind", "flow").maybeSingle();
  if (!flow) return {} as Record<string, string>;
  const { data } = await sb.from("tasks").select("tool_state").eq("job_id", flow.id).eq("tool", "yellow").maybeSingle();
  const ts = (data?.tool_state ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(ts).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, (v as string).trim()])) as Record<string, string>;
}

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

// ── 3. Sub-account, user, login email ────────────────────────────────────────

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

export type SubAccount = { id: string; name: string; email: string; city: string; dateAdded: string };

/** Every sub-account under the agency, newest first, for linking one to a client. */
export async function listSubAccounts(): Promise<SubAccount[]> {
  const key = process.env.GHL_AGENCY_KEY;
  const companyId = process.env.GHL_COMPANY_ID || "SGOwJa0dWkFiHgpbwzY0";
  if (!key) throw new Error("GHL_AGENCY_KEY isn't set on the Tracker.");
  const out: SubAccount[] = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    const res = await ghl<{ locations?: Record<string, string>[] }>(`/locations/search?companyId=${companyId}&limit=100&skip=${skip}`, key, { method: "GET" });
    const page = res.locations ?? [];
    out.push(...page.map((l) => ({ id: l.id, name: l.name ?? "", email: l.email ?? "", city: l.city ?? "", dateAdded: l.dateAdded ?? "" })));
    if (page.length < 100) break;
  }
  return out.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
}

/**
 * Mpume has created the sub-account in GHL: record it, close her task, and
 * carry on with the user and login email if both milestones are done.
 */
export async function linkSubAccount(sb: SupabaseClient, clientId: string, locationId: string) {
  const sub = (await listSubAccounts()).find((l) => l.id === locationId.trim());
  if (!sub) throw new Error("That sub-account isn't in the agency. Pick it from the list, or check the ID.");
  const url = `https://app.gohighlevel.com/location/${sub.id}/dashboard`;
  await sb.from("clients").update({ ghutte_location_id: sub.id, ghutte_error: null }).eq("id", clientId);
  const { data: flow } = await sb.from("jobs").select("id").eq("client_id", clientId).eq("kind", "flow").maybeSingle();
  if (flow) {
    const { data: rows } = await sb.from("tasks").select("id, tool_state").eq("job_id", flow.id).eq("tool", "account");
    for (const t of (rows ?? []) as Pick<Task, "id" | "tool_state">[]) {
      await sb.from("tasks").update({ status: "closed_out", tool_state: { ...(t.tool_state ?? {}), state: "done", location_id: sub.id, url, name: sub.name } }).eq("id", t.id);
    }
  }
  return runGhutteSetup(sb, clientId);
}

// Temporary password: 14 characters with upper, lower, digit and symbol.
function tempPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*?"];
  const all = sets.join("");
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < 14) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function loginEmail(sb: SupabaseClient, client: Client, email: string, password: string) {
  const { loginUrl } = await ghutteSettings(sb);
  const first = client.name.split(" ")[0];
  const body = [
    `Hi ${first},`,
    `Welcome to Ghutte! Your account is ready, and this is where your pages, emails, payments and contacts will live.`,
    `**Your login**`,
    [`- Link: ${loginUrl || "[login link]"}`, `- Email: ${email}`, `- Temporary password: ${password}`].join("\n"),
    `Please log in and change your password straight away (click your profile picture, then Profile, then Password).`,
    `Any trouble logging in, just reply to this email.`,
    CLIENT_SENDER.signOff,
  ].join("\n\n");
  await sendGmail({
    to: email,
    cc: CLIENT_SENDER.proposalCc,
    subject: "Your Ghutte login",
    text: body,
    html: emailHtml(body),
    fromName: CLIENT_SENDER.name,
    replyTo: CLIENT_SENDER.replyTo,
  });
}

/** Add the client as a user on their sub-account and email the login. */
async function addClientUser(sb: SupabaseClient, client: Client, locationId: string) {
  const key = process.env.GHL_AGENCY_KEY;
  const companyId = process.env.GHL_COMPANY_ID || "SGOwJa0dWkFiHgpbwzY0";
  if (!key) throw new Error("GHL_AGENCY_KEY isn't set on the Tracker.");
  const ys = await yellowSheet(sb, client.id);
  const email = client.email || ys.email;
  if (!email) throw new Error(`Add ${client.name}'s email so Ghutte can create their login.`);
  const { firstName, lastName } = ys.first_name ? { firstName: ys.first_name, lastName: ys.last_name ?? "" } : splitName(client.name);
  const password = tempPassword();
  const res = await ghl<{ id?: string }>("/users/", key, {
    method: "POST",
    body: {
      companyId,
      firstName,
      lastName: lastName || firstName,
      email,
      password,
      phone: client.phone || ys.phone || "",
      type: "account",
      role: "admin",
      locationIds: [locationId],
    },
  });
  if (!res.id) throw new Error("Ghutte didn't return the new user's id.");
  await sb.from("clients").update({ ghutte_user_id: res.id }).eq("id", client.id);
  await loginEmail(sb, client, email, password);
  await sb.from("clients").update({ ghutte_login_sent_at: new Date().toISOString() }).eq("id", client.id);
}

/** Set a fresh temporary password and email it again (e.g. the first email failed). */
export async function resendLogin(sb: SupabaseClient, clientId: string) {
  const key = process.env.GHL_AGENCY_KEY;
  if (!key) throw new Error("GHL_AGENCY_KEY isn't set on the Tracker.");
  const { data } = await sb.from("clients").select("*").eq("id", clientId).single();
  const client = data as Client;
  if (!client.ghutte_user_id) throw new Error("They don't have a Ghutte user yet.");
  const ys = await yellowSheet(sb, client.id);
  const email = client.email || ys.email;
  if (!email) throw new Error(`Add ${client.name}'s email first.`);
  const password = tempPassword();
  await ghl(`/users/${client.ghutte_user_id}`, key, { method: "PUT", body: { password } });
  await loginEmail(sb, client, email, password);
  await sb.from("clients").update({ ghutte_login_sent_at: new Date().toISOString(), ghutte_error: null }).eq("id", client.id);
}

/**
 * Run whatever's left of the Ghutte setup once both milestones are done. Safe
 * to call repeatedly: each step is skipped once it's recorded on the client.
 */
export async function runGhutteSetup(sb: SupabaseClient, clientId: string): Promise<string> {
  const { data } = await sb.from("clients").select("*").eq("id", clientId).single();
  const client = data as Client | null;
  if (!client) return "Client not found.";
  if (!client.proposal_accepted_at || !client.ghutte_paid_at) return "Waiting for both milestones.";
  try {
    const locationId = client.ghutte_location_id;
    if (!locationId) {
      await requestSubAccount(sb, client);
      await sb.from("clients").update({ ghutte_error: null }).eq("id", clientId);
      return "Mpume has the “Create Ghutte sub-account” task for today. Once she links it, the login goes out.";
    }
    if (!client.ghutte_user_id) await addClientUser(sb, client, locationId);
    await sb.from("clients").update({ ghutte_error: null }).eq("id", clientId);
    return "Ghutte is set up and the login has been emailed.";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ghutte setup failed.";
    await sb.from("clients").update({ ghutte_error: msg }).eq("id", clientId);
    return msg;
  }
}
