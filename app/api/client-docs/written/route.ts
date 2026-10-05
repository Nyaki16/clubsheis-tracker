import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Apps Script reports the Google Docs it wrote (shared secret).
export async function POST(req: Request) {
  const secret = process.env.CALENDAR_SYNC_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const { writes } = (await req.json()) as { writes: { id: string; clientId: string; kind: "profile" | "strategy"; docId: string; url: string }[] };
  if (!Array.isArray(writes)) return Response.json({ error: "Expected { writes: [...] }" }, { status: 400 });

  const sb = createAdminClient();
  for (const w of writes) {
    if (!w.id || !w.docId) continue;
    await sb.from("client_documents").update({ gdoc_written: true }).eq("id", w.id);
    await sb
      .from("clients")
      .update(
        w.kind === "profile"
          ? { profile_gdoc_id: w.docId, client_profile_doc_url: w.url }
          : { strategy_gdoc_id: w.docId, strategy_brief_doc_url: w.url }
      )
      .eq("id", w.clientId);
  }
  return Response.json({ ok: true, written: writes.length });
}
