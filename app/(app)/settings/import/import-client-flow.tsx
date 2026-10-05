"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { packageLabel } from "@/lib/flow";
import type { PlanItem } from "@/lib/client-flow-import";

const btn = "text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-50";
const TONE: Record<PlanItem["action"], string> = {
  create: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  match: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  skip: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};
const LABEL: Record<PlanItem["action"], string> = { create: "New", match: "Matched", skip: "Skip" };

export default function ImportClientFlow() {
  const router = useRouter();
  const [items, setItems] = useState<PlanItem[] | null>(null);
  const [results, setResults] = useState<{ name: string; action: string; tasks: number; error?: string }[] | null>(null);
  const [busy, setBusy] = useState<"" | "plan" | "apply">("");
  const [error, setError] = useState("");

  async function preview() {
    setBusy("plan");
    setError("");
    try {
      const res = await fetch("/api/import/client-flow");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setItems(j.items);
      setResults(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the preview.");
    } finally {
      setBusy("");
    }
  }

  async function run() {
    setBusy("apply");
    setError("");
    try {
      const res = await fetch("/api/import/client-flow", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setResults(j.results);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed.");
    } finally {
      setBusy("");
    }
  }

  const count = (a: PlanItem["action"]) => items?.filter((i) => i.action === a).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">Import from Client Flow</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
          Brings every client from the old Client Flow app into the Tracker with their package, progress, discovery notes, proposal,
          Ghutte sub-account, checklist ticks and copy drafts. Strategy documents are kept in a “Client Flow archive” job on each client.
          Preview first; nothing is written until you click Import. Running it again won&apos;t duplicate anyone.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button onClick={preview} disabled={!!busy} className={`${btn} border border-slate-300 dark:border-slate-600`}>
          {busy === "plan" ? "Reading the Client Flow…" : items ? "Refresh preview" : "Preview import"}
        </button>
        {items && !results && (
          <button onClick={run} disabled={!!busy || !count("create") && !count("match")} className={`${btn} bg-gradient-to-r from-purple-600 to-pink-600 text-white`}>
            {busy === "apply" ? "Importing…" : `Import ${count("create") + count("match")} clients`}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {results && (
        <section className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 p-4 text-sm">
          <p className="font-semibold">
            Imported {results.filter((r) => !r.error).length} clients ({results.reduce((n, r) => n + r.tasks, 0)} tasks).
          </p>
          {results.some((r) => r.error) && (
            <ul className="mt-2 text-rose-700 dark:text-rose-300 list-disc pl-5">
              {results.filter((r) => r.error).map((r) => (
                <li key={r.name}>{r.name}: {r.error}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {items && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <div className="px-4 py-3 text-sm text-slate-500 border-b border-slate-200 dark:border-slate-800">
            {count("create")} new · {count("match")} matched to existing Tracker clients · {count("skip")} skipped
          </div>
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-4 py-2.5 font-semibold">What happens</th>
                <th className="px-4 py-2.5 font-semibold">Package</th>
                <th className="px-4 py-2.5 font-semibold">Old stage</th>
                <th className="px-4 py-2.5 font-semibold">Brings across</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.flowId} className="border-b last:border-0 border-slate-100 dark:border-slate-800 align-top">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold">{i.name}</p>
                    <p className="text-xs text-slate-400">{[i.business, i.email].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TONE[i.action]}`}>{LABEL[i.action]}</span>
                    <p className="text-xs text-slate-400 mt-1">{i.action === "match" ? `Into ${i.matchName}` : i.reason}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{packageLabel(i.package)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{i.oldStage}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{i.carries.join(", ") || "Contact details"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
