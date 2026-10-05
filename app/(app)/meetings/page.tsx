import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Meeting } from "@/lib/types";

const KINDS: Record<string, string> = {
  team_scroll: "Team Scroll",
  boardroom: "Boardroom",
  client: "Client",
  discovery: "Discovery",
  one_on_one: "One-on-one",
  internal: "Internal",
  other: "Other",
};
// Escape the notes text, then restore only the <b> highlights from ts_headline.
const safeSnippet = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&lt;(\/?)b&gt;/g, "<$1b>");
const when = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const { q = "", kind = "" } = await searchParams;
  const supabase = await createClient();
  let rows: { id: string; title: string; starts_at: string | null; kind: string; snippet?: string; hasNotes: boolean }[] = [];
  if (q.trim()) {
    const { data } = await supabase.rpc("search_meetings", { q, kinds: kind ? [kind] : null, lim: 50 });
    rows = ((data ?? []) as { id: string; title: string; starts_at: string; kind: string; snippet: string }[]).map((r) => ({ ...r, hasNotes: true }));
  } else {
    let query = supabase.from("meetings").select("id, title, starts_at, kind, notes").lte("starts_at", new Date().toISOString()).order("starts_at", { ascending: false }).limit(80);
    if (kind) query = query.eq("kind", kind);
    const { data } = await query;
    rows = ((data ?? []) as Pick<Meeting, "id" | "title" | "starts_at" | "kind" | "notes">[]).map((m) => ({ ...m, hasNotes: !!m.notes.trim() }));
  }
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">Meetings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Every meeting Debbie knows about, with its Gemini notes. Search, or <Link href="/debbie" className="underline">ask Debbie</Link> a question instead.
        </p>
      </header>
      <form className="flex flex-wrap gap-2" action="/meetings">
        <input
          name="q"
          defaultValue={q}
          placeholder='Search notes, e.g. "price increase" or Anele'
          aria-label="Search meetings"
          className="w-80 max-w-full text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5"
        />
        <select name="kind" defaultValue={kind} aria-label="Meeting type" className="text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5">
          <option value="">All meetings</option>
          {Object.entries(KINDS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="text-sm font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md">Search</button>
      </form>
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {rows.length ? (
          rows.map((m) => (
            <Link key={m.id} href={`/meetings/${m.id}`} className="block px-5 py-3 border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{m.title || "Meeting"}</span>
                <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{KINDS[m.kind] ?? m.kind}</span>
                <span className="text-xs text-slate-400">{when(m.starts_at)}</span>
                {!m.hasNotes && <span className="text-xs text-slate-400">· no notes</span>}
              </div>
              {m.snippet && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: safeSnippet(m.snippet) }} />
              )}
            </Link>
          ))
        ) : (
          <p className="px-5 py-6 text-sm text-slate-400">{q ? "No meetings match." : "No meetings yet. They arrive with the calendar sync."}</p>
        )}
      </section>
    </div>
  );
}
