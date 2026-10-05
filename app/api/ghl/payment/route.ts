import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { ghutteSettings, matchPayingClient, runGhutteSetup } from "@/lib/ghutte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Body) : {});

/**
 * Public: GHL's "payment received" workflow calls this (Webhook action) with the
 * secret from Settings → Ghutte in the link. It ticks Ghutte Payment Made for the
 * matching client and, if their proposal is accepted, sets up Ghutte.
 */
export async function POST(req: Request) {
  const sb = createAdminClient();
  const { webhookSecret } = await ghutteSettings(sb);
  const key = new URL(req.url).searchParams.get("key");
  if (!webhookSecret || key !== webhookSecret) return Response.json({ error: "Not allowed." }, { status: 401 });

  const body = ((await req.json().catch(() => null)) ?? {}) as Body;
  const contact = obj(body.contact);
  const payment = { ...obj(body.order), ...obj(body.payment), ...obj(body.invoice) };
  const who = {
    contactId: str(body.contact_id) || str(contact.id) || str(body.contactId),
    email: str(body.email) || str(contact.email),
    phone: str(body.phone) || str(contact.phone),
  };
  const client = await matchPayingClient(sb, who);

  const record = {
    source: "GHL",
    received_at: new Date().toISOString(),
    amount: str(payment.total_amount) || str(payment.amount) || str(body.amount) || null,
    currency: str(payment.currency) || str(body.currency) || null,
    product: str(payment.product_name) || str(payment.name) || str(body.product_name) || null,
    email: who.email || null,
    contact_id: who.contactId || null,
  };

  if (!client) {
    // Keep the last few unmatched payments so the team can see what came in.
    const { data } = await sb.from("app_settings").select("value").eq("key", "ghl_unmatched_payments").maybeSingle();
    const list = (((data?.value ?? {}) as { items?: unknown[] }).items ?? []).slice(0, 19);
    await sb.from("app_settings").upsert({ key: "ghl_unmatched_payments", value: { items: [record, ...list] }, updated_at: record.received_at });
    return Response.json({ matched: false });
  }

  await sb.from("clients").update({ ghutte_paid_at: record.received_at, ghutte_payment: record, ...(who.contactId && !client.ghl_contact_id ? { ghl_contact_id: who.contactId } : {}) }).eq("id", client.id);
  revalidatePath(`/clients/${client.id}`);
  if (client.proposal_accepted_at) {
    after(async () => {
      await runGhutteSetup(sb, client.id);
      revalidatePath(`/clients/${client.id}`);
    });
  }
  return Response.json({ matched: true, client: client.name });
}
