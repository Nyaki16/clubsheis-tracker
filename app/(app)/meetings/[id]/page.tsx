import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Meeting } from "@/lib/types";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("meetings").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const m = data as Meeting;
  const { data: links } = await supabase.from("meeting_clients").select("clients(id, name)").eq("meeting_id", id);
  const clients = ((links ?? []) as unknown as { clients: { id: string; name: string } | null }[]).map((l) => l.clients).filter(Boolean) as { id: string; name: string }[];
  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <Link href="/meetings" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">← All meetings</Link>
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold">{m.title || "Meeting"}</h1>
        <p className="text-sm text-slate-500">
          {m.starts_at ? new Date(m.starts_at).toLocaleString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Undated"}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {m.attendees.length > 0 && <span>{m.attendees.map((a) => a.name || a.email.split("@")[0]).join(", ")}</span>}
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">{c.name}</Link>
          ))}
          {m.notes_url && (
            <a href={m.notes_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
              Notes by Gemini <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </header>
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        {m.notes.trim() ? (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{m.notes}</pre>
        ) : (
          <p className="text-sm text-slate-400">No notes for this meeting.</p>
        )}
      </section>
    </div>
  );
}
