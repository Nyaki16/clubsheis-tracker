import { createClient } from "@/lib/supabase/server";
import { updateClientDocs } from "@/lib/client-docs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// "Update now" on the client page: rewrite the Client Profile and Strategy Brief.
export async function POST(_req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sign in first." }, { status: 401 });
  try {
    await updateClientDocs(supabase, clientId);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't update the documents." }, { status: 500 });
  }
}
