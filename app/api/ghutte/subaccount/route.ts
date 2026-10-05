import { createClient } from "@/lib/supabase/server";
import { loadProposalContext } from "@/lib/proposal-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GHL_API = "https://services.leadconnectorhq.com";

// Create the client's Ghutte (GoHighLevel) sub-account under the agency.
// Ported from the Client Flow app; the agency key now lives in env, not code.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sign in first." }, { status: 401 });

  const key = process.env.GHL_AGENCY_KEY;
  const companyId = process.env.GHL_COMPANY_ID || "SGOwJa0dWkFiHgpbwzY0";
  if (!key) return Response.json({ error: "Ghutte isn't connected yet: add GHL_AGENCY_KEY to the Tracker's Vercel environment variables." }, { status: 500 });

  const { taskId } = (await req.json()) as { taskId: string };
  const ctx = await loadProposalContext(supabase, taskId);
  if (!ctx) return Response.json({ error: "Task not found." }, { status: 404 });
  const { client, task } = ctx;
  if (task.tool_state?.location_id) return Response.json({ error: "This client already has a sub-account." }, { status: 409 });

  // The Yellow Sheet's "Your details" fill the business profile when the client
  // has sent it; otherwise the client record, with Johannesburg defaults.
  const ys = (ctx.siblings.find((t) => t.tool === "yellow")?.tool_state ?? {}) as Record<string, string>;
  const v = (k: string) => (typeof ys[k] === "string" ? ys[k].trim() : "");
  const name = v("business_name") || client.business_name || client.name;
  const country = v("country");
  const res = await fetch(`${GHL_API}/locations/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, Version: "2021-07-28" },
    body: JSON.stringify({
      companyId,
      name,
      email: v("email") || client.email || "info@clubsheis.com",
      phone: v("phone") || client.phone || "",
      website: v("website") || client.website_url || "",
      address: v("address"),
      city: v("city") || "Johannesburg",
      state: v("state") || "Gauteng",
      country: !country || /south africa|^za$|^rsa$/i.test(country) ? "ZA" : country,
      postalCode: v("postal_code") || "2000",
      timezone: "Africa/Johannesburg",
      ...(v("first_name") || v("last_name")
        ? { prospectInfo: { firstName: v("first_name"), lastName: v("last_name"), email: v("email") || client.email || "" } }
        : {}),
    }),
  });
  const text = await res.text();
  if (!res.ok) return Response.json({ error: `Ghutte said no (${res.status}): ${text.slice(0, 300)}` }, { status: 502 });
  const locationId = (JSON.parse(text) as { id?: string }).id;
  if (!locationId) return Response.json({ error: "Ghutte didn't return a sub-account id." }, { status: 502 });

  const url = `https://app.gohighlevel.com/location/${locationId}/dashboard`;
  await supabase
    .from("tasks")
    .update({ status: "closed_out", tool_state: { ...task.tool_state, state: "done", location_id: locationId, url, name } })
    .eq("id", taskId);
  return Response.json({ locationId, url });
}
