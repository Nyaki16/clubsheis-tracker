import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1x1 transparent GIF.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// Open-tracking pixel in proposal emails. Public (the client's mail app loads
// it), so it only ever records the first open time on a sent proposal task.
export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  try {
    const supabase = createAdminClient();
    const { data: task } = await supabase.from("tasks").select("tool, tool_state").eq("id", taskId).maybeSingle();
    const ts = (task?.tool_state ?? {}) as Record<string, unknown>;
    if (task?.tool === "proposal" && ts.state === "sent" && !ts.opened_at) {
      await supabase.from("tasks").update({ tool_state: { ...ts, opened_at: new Date().toISOString() } }).eq("id", taskId);
    }
  } catch {
    // Never let tracking break the image.
  }
  return new Response(new Uint8Array(PIXEL), {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, private" },
  });
}
