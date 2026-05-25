import { createClient } from "@supabase/supabase-js";
import type { ClientFlowDocs } from "./types";

// Service-role client for the *clubsheis-client-flow* Supabase project (the
// upstream funnel app that generates strategy docs). Use ONLY from server
// routes — bypasses RLS, never expose to the browser.
function createClientFlowAdmin() {
  const url = process.env.CLIENT_FLOW_SUPABASE_URL;
  const key = process.env.CLIENT_FLOW_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const FIELD_MAP: { stage: string; field: string; out: keyof ClientFlowDocs }[] = [
  { stage: "strategy", field: "client_profile_doc_url", out: "client_profile_doc_url" },
  { stage: "strategy", field: "research_bible_doc_url", out: "research_bible_doc_url" },
  { stage: "strategy", field: "brand_voice_doc_url", out: "brand_voice_doc_url" },
  { stage: "strategy-brief", field: "brief_doc_url", out: "strategy_brief_doc_url" },
];

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Look up doc URLs in the client-flow Supabase by matching client name.
// Returns null fields when nothing is configured or no match is found —
// callers should fall back to manual override columns on the tracker side.
export async function fetchClientFlowDocs(
  clientName: string
): Promise<ClientFlowDocs> {
  const empty: ClientFlowDocs = {
    client_profile_doc_url: null,
    research_bible_doc_url: null,
    brand_voice_doc_url: null,
    strategy_brief_doc_url: null,
  };

  const sb = createClientFlowAdmin();
  if (!sb) return empty;

  try {
    const { data: clientsRows, error: clientsErr } = await sb
      .from("flow_clients")
      .select("id, name");
    if (clientsErr || !clientsRows) return empty;

    const target = normalizeName(clientName);
    const match = clientsRows.find(
      (c) => c.name && normalizeName(c.name) === target
    );
    if (!match) return empty;

    const { data: rows, error } = await sb
      .from("flow_stage_data")
      .select("stage_key, field_key, field_value")
      .eq("client_id", match.id);
    if (error || !rows) return empty;

    const out: ClientFlowDocs = { ...empty };
    for (const row of rows) {
      const m = FIELD_MAP.find(
        (f) => f.stage === row.stage_key && f.field === row.field_key
      );
      if (m && row.field_value) out[m.out] = row.field_value;
    }
    return out;
  } catch {
    return empty;
  }
}
