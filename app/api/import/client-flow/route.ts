import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apply, plan } from "@/lib/client-flow-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "Sign in first.";
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).single();
  return me?.is_admin ? null : "Only Tracker admins can run the import.";
}

// Preview: what the import would do, per client. Writes nothing.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return Response.json({ error: denied }, { status: 403 });
  try {
    return Response.json({ items: await plan(createAdminClient()) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't read the Client Flow." }, { status: 500 });
  }
}

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return Response.json({ error: denied }, { status: 403 });
  try {
    return Response.json({ results: await apply(createAdminClient()) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "The import failed." }, { status: 500 });
  }
}
