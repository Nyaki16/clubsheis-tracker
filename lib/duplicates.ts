// Finding clients that are probably the same person (e.g. a Tracker client and
// a calendar booking made with a different email, or a name typo).

import type { Client } from "./types";

export const normName = (s: string | null | undefined) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Last nine digits, so "072 494 0492" and "+27 72 494 0492" match.
export const phoneKey = (s: string | null | undefined) => {
  const d = String(s ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};

function distance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export type ClientStats = { flowTasks: number; jobs: number; dates: number };
export type DuplicatePair = { key: string; a: Client; b: Client; reasons: string[]; keep: "a" | "b" };

export const pairKey = (x: string, y: string) => [x, y].sort().join(":");

function richness(c: Client, s: ClientStats | undefined) {
  const filled = [c.email, c.phone, c.business_name, c.website_url, c.instagram_url, c.google_drive_url, c.package, c.call_at].filter(Boolean).length;
  return (s?.flowTasks ?? 0) * 10 + (s?.jobs ?? 0) * 3 + (s?.dates ?? 0) + (c.is_past_lead ? 0 : 8) + filled;
}

export function findDuplicates(clients: Client[], stats: Record<string, ClientStats>, ignored: Set<string>): DuplicatePair[] {
  const out: DuplicatePair[] = [];
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const a = clients[i];
      const b = clients[j];
      const key = pairKey(a.id, b.id);
      if (ignored.has(key)) continue;
      const reasons: string[] = [];
      if (a.email && b.email && a.email.trim().toLowerCase() === b.email.trim().toLowerCase()) reasons.push("Same email");
      if (phoneKey(a.phone) && phoneKey(a.phone) === phoneKey(b.phone)) reasons.push("Same phone");
      const na = normName(a.name);
      const nb = normName(b.name);
      if (na && na === nb) reasons.push("Same name");
      else if (na.length >= 6 && nb.length >= 6 && distance(na, nb) <= 2) reasons.push("Almost the same name");
      else if (na && nb) {
        const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
        // Hyphens are already spaces here, so "Somaguda-Mathibedi" is covered.
        if (short.length >= 4 && long.startsWith(short + " ")) reasons.push("One name starts with the other");
      }
      const ba = normName(a.business_name);
      if (ba.length >= 4 && ba === normName(b.business_name) && !reasons.length) reasons.push("Same business name");
      if (!reasons.length) continue;
      out.push({ key, a, b, reasons, keep: richness(a, stats[a.id]) >= richness(b, stats[b.id]) ? "a" : "b" });
    }
  }
  // Strongest evidence first.
  const weight = (p: DuplicatePair) => (p.reasons.includes("Same email") ? 4 : 0) + (p.reasons.includes("Same phone") ? 3 : 0) + (p.reasons.includes("Same name") ? 2 : 0) + p.reasons.length;
  return out.sort((x, y) => weight(y) - weight(x) || x.a.name.localeCompare(y.a.name));
}
