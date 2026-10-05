import { createClient } from "@/lib/supabase/server";
import { loadProposalContext } from "@/lib/proposal-server";
import { createSubAccount } from "@/lib/ghutte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Create the client's Ghutte (GoHighLevel) sub-account under the agency, from
// the Ghutte setup task's button. The milestones do the same automatically.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sign in first." }, { status: 401 });

  const { taskId } = (await req.json()) as { taskId: string };
  const ctx = await loadProposalContext(supabase, taskId);
  if (!ctx) return Response.json({ error: "Task not found." }, { status: 404 });
  if (ctx.task.tool_state?.location_id || ctx.client.ghutte_location_id) {
    return Response.json({ error: "This client already has a sub-account." }, { status: 409 });
  }
  try {
    const { locationId, url } = await createSubAccount(supabase, ctx.client);
    return Response.json({ locationId, url });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't create the sub-account." }, { status: 502 });
  }
}
