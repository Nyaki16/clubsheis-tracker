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

  const name = client.business_name || client.name;
  const res = await fetch(`${GHL_API}/locations/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, Version: "2021-07-28" },
    body: JSON.stringify({
      companyId,
      name,
      email: client.email || "info@clubsheis.com",
      phone: client.phone || "",
      website: client.website_url || "",
      address: "",
      city: "Johannesburg",
      state: "Gauteng",
      country: "ZA",
      postalCode: "2000",
      timezone: "Africa/Johannesburg",
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
