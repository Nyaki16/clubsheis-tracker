import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOC_TITLES, processDirtyClients, type DocKind } from "@/lib/client-docs";
import { processTeamScrolls } from "@/lib/debbie";
import { maybeWriteWeeklyBriefing } from "@/lib/briefing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const folderId = (url: string | null) => url?.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? "";

// Called by the calendar Apps Script after each sync (shared secret).
// Returns documents waiting to be copied into Google Docs, then — after the
// response — runs Debbie Recommends on a new Team Scroll and refreshes up to
// two clients whose meeting notes changed.
export async function POST(req: Request) {
  const secret = process.env.CALENDAR_SYNC_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const sb = createAdminClient();

  const { data: rows } = await sb
    .from("client_documents")
    .select("id, client_id, kind, content, created_at")
    .eq("gdoc_written", false)
    .order("created_at", { ascending: false })
    .limit(200);
  const latest = new Map<string, { id: string; client_id: string; kind: DocKind; content: string }>();
  const superseded: string[] = [];
  for (const r of rows ?? []) {
    const key = `${r.client_id}:${r.kind}`;
    if (latest.has(key)) superseded.push(r.id);
    else latest.set(key, r as { id: string; client_id: string; kind: DocKind; content: string });
  }
  if (superseded.length) await sb.from("client_documents").update({ gdoc_written: true }).in("id", superseded);

  const items = [...latest.values()].slice(0, 15);
  const ids = [...new Set(items.map((i) => i.client_id))];
  const { data: clients } = ids.length
    ? await sb.from("clients").select("id, name, business_name, google_drive_url, profile_gdoc_id, strategy_gdoc_id").in("id", ids)
    : { data: [] };
  const byId = new Map((clients ?? []).map((c) => [c.id, c]));
  const writes = items.flatMap((i) => {
    const c = byId.get(i.client_id);
    if (!c) return [];
    return [{
      id: i.id,
      clientId: i.client_id,
      kind: i.kind,
      title: `${c.business_name || c.name} — ${DOC_TITLES[i.kind]}`,
      content: i.content,
      docId: (i.kind === "profile" ? c.profile_gdoc_id : c.strategy_gdoc_id) || "",
      folderId: folderId(c.google_drive_url),
    }];
  });

  after(async () => {
    await processTeamScrolls(sb, 1);
    await processDirtyClients(sb, 2);
    await maybeWriteWeeklyBriefing(sb).catch(() => {});
  });
  return Response.json({ writes });
}
