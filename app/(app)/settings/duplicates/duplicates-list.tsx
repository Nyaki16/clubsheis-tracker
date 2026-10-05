"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { packageLabel } from "@/lib/flow";
import type { ClientStats, DuplicatePair } from "@/lib/duplicates";
import type { Client } from "@/lib/types";
import { ignoreDuplicate, mergeClients } from "@/app/actions/duplicates";
import { useToast } from "@/components/flow/ui";

type Stats = Record<string, ClientStats & { flowDone: number }>;

export default function DuplicatesList({ pairs, stats }: { pairs: DuplicatePair[]; stats: Stats }) {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">Duplicates</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
          Clients that look like the same person. Merging keeps one record, fills in anything it&apos;s missing from the other
          (email, phone, booked call, Gemini notes), moves all jobs, tasks and key dates across, then deletes the extra one.
        </p>
      </header>
      {pairs.length ? (
        pairs.map((p) => <PairCard key={p.key} pair={p} stats={stats} />)
      ) : (
        <p className="text-sm text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-6">
          No likely duplicates. Nice and tidy.
        </p>
      )}
    </div>
  );
}

function PairCard({ pair, stats }: { pair: DuplicatePair; stats: Stats }) {
  const toast = useToast();
  const [keep, setKeep] = useState<"a" | "b">(pair.keep);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const kept = keep === "a" ? pair.a : pair.b;
  const dropped = keep === "a" ? pair.b : pair.a;

  const act = (fn: () => Promise<unknown>, msg: string) =>
    start(async () => {
      setError("");
      try {
        await fn();
        toast(msg);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-200 dark:border-slate-800">
        {pair.reasons.map((r) => (
          <span key={r} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            {r}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        {(["a", "b"] as const).map((side) => (
          <ClientSide key={side} client={pair[side]} stats={stats[pair[side].id]} keep={keep === side} onKeep={() => setKeep(side)} name={pair.key} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800">
        <button
          disabled={pending}
          onClick={() => act(() => mergeClients(kept.id, dropped.id), `Merged into ${kept.name}`)}
          className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          {pending ? "Working…" : `Merge into ${kept.name}`}
        </button>
        <button
          disabled={pending}
          onClick={() => act(() => ignoreDuplicate(pair.a.id, pair.b.id), "Marked as not a duplicate")}
          className="text-sm font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          Not a duplicate
        </button>
        <span className="text-xs text-slate-400">{dropped.name} will be removed after its details and work move across.</span>
        {error && <p className="w-full text-sm text-rose-600">{error}</p>}
      </div>
    </section>
  );
}

function ClientSide({
  client: c,
  stats: s,
  keep,
  onKeep,
  name,
}: {
  client: Client;
  stats?: ClientStats & { flowDone: number };
  keep: boolean;
  onKeep: () => void;
  name: string;
}) {
  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="flex gap-2 text-xs">
        <span className="w-20 shrink-0 text-slate-400">{label}</span>
        <span className="min-w-0 break-words">{value}</span>
      </div>
    ) : null;
  return (
    <label className={`flex gap-3 p-5 cursor-pointer md:[&:first-child]:border-r border-slate-200 dark:border-slate-800 ${keep ? "bg-purple-50/60 dark:bg-purple-500/10" : ""}`}>
      <input type="radio" name={name} checked={keep} onChange={onKeep} className="mt-1 accent-purple-600" />
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/clients/${c.id}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
            {c.name}
          </Link>
          {keep && <span className="text-[10.5px] font-semibold uppercase tracking-wider text-purple-600">Keep</span>}
          {c.is_past_lead && <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">Past lead</span>}
        </div>
        {row("Business", c.business_name)}
        {row("Package", c.package ? packageLabel(c.package) : null)}
        {row("Flow", s?.flowTasks ? `${s.flowDone}/${s.flowTasks} tasks done` : "No client flow")}
        {row("Jobs", s?.jobs ? `${s.jobs} other job${s.jobs === 1 ? "" : "s"}` : null)}
        {row("Email", c.email)}
        {row("Phone", c.phone)}
        {row("Call", c.call_at ? `${new Date(c.call_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}${c.call_notes_url ? " · Gemini notes" : ""}` : null)}
        {row("Source", c.source === "calendar" ? "Calendar booking" : c.source === "client_flow" ? "Imported from Client Flow" : "Added in the Tracker")}
      </div>
    </label>
  );
}
