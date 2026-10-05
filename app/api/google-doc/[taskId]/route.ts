import { createClient } from "@/lib/supabase/server";
import { loadProposalContext } from "@/lib/proposal-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Folder id from a Drive folder link, so docs land in the client's folder.
const folderId = (url: string | null) => url?.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? "";

// Save an approved draft as a formatted Google Doc via the ClubSheIs Apps
// Script (ported from the Client Flow app). Apps Script answers POSTs with a
// redirect, and fetch would turn the follow-up into a GET, so follow by hand.
export async function POST(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sign in first." }, { status: 401 });

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl) {
    return Response.json({ error: "Saving to Drive isn't set up yet: add GOOGLE_APPS_SCRIPT_URL to the Tracker's Vercel environment variables." }, { status: 500 });
  }
  const ctx = await loadProposalContext(supabase, taskId);
  if (!ctx) return Response.json({ error: "Task not found." }, { status: 404 });
  const content = typeof ctx.task.tool_state?.text === "string" ? (ctx.task.tool_state.text as string) : "";
  if (!content.trim()) return Response.json({ error: "Nothing to save yet." }, { status: 400 });

  const title = `${ctx.client.business_name || ctx.client.name}_${ctx.task.title}`.replace(/\s+/g, "_");
  const payload = JSON.stringify({ title, content, folderId: folderId(ctx.client.google_drive_url) });

  try {
    let res = await fetch(scriptUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, redirect: "manual" });
    for (let i = 0; i < 5 && [301, 302, 303, 307, 308].includes(res.status); i++) {
      const location = res.headers.get("location");
      if (!location) break;
      // Re-send the POST, as the Client Flow app did against this same script.
      res = await fetch(location, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, redirect: "manual" });
    }
    const text = await res.text();
    if (!res.ok) return Response.json({ error: `Apps Script error (${res.status}): ${text.slice(0, 200)}` }, { status: 502 });
    const data = JSON.parse(text) as { url?: string; docUrl?: string; error?: string };
    const url = data.url || data.docUrl;
    if (!url) return Response.json({ error: data.error || `Unexpected response: ${text.slice(0, 200)}` }, { status: 502 });

    await supabase.from("tasks").update({ tool_state: { ...ctx.task.tool_state, doc_url: url } }).eq("id", taskId);
    return Response.json({ url });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't reach Google Drive." }, { status: 502 });
  }
}
