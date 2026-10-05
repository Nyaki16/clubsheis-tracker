"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, Copy } from "lucide-react";
import { useToast } from "@/components/flow/ui";

const STEPS = [
  <>Sign in to Google as <b>info@clubsheis.com</b> and open <a className="underline" href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer">a new Apps Script project</a>. Name it “ClubSheIs calendar sync”.</>,
  <>Replace everything in <code>Code.gs</code> with the script below and save.</>,
  <>In the left sidebar, click <b>Services (+)</b>, choose <b>Google Calendar API</b>, and click <b>Add</b>.</>,
  <>Open <b>Project Settings</b> (the cog) → <b>Script properties</b> and add two: <code>TRACKER_URL</code> = <code>https://clubsheis-tracker.vercel.app</code>, and <code>SYNC_SECRET</code> = the same value as <code>CALENDAR_SYNC_SECRET</code> on Vercel.</>,
  <>Back in the editor, pick <b>backfill</b> in the function menu and click <b>Run</b>. Approve the permissions it asks for. This imports every discovery call since November 2025.</>,
  <>Pick <b>installTrigger</b> and click <b>Run</b>. From now on new bookings and Gemini notes arrive every 10 minutes.</>,
];

export default function CalendarSetup({
  lastSync,
  migrated,
  secretSet,
}: {
  lastSync: Record<string, unknown> | null;
  migrated: boolean;
  secretSet: boolean;
}) {
  const toast = useToast();
  const [script, setScript] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/calendar-sync.gs")
      .then((r) => r.text())
      .then((t) => alive && setScript(t))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const at = typeof lastSync?.at === "string" ? new Date(lastSync.at) : null;
  const n = (k: string) => Number(lastSync?.[k] ?? 0);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Discovery calls booked in info@clubsheis.com&apos;s calendar become clients automatically, with their Gemini notes.
        </p>
      </header>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-start gap-3">
        <CalendarDays className="w-5 h-5 mt-0.5 text-purple-600" />
        <div className="text-sm">
          {at ? (
            <>
              <p className="font-semibold">Connected · last sync {at.toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-slate-500 mt-0.5">
                That run: {n("leads")} new leads, {n("past")} past leads archived, {n("updated")} existing clients updated, {n("notes")} Gemini notes added
                {n("cancelled") ? `, ${n("cancelled")} cancelled calls flagged` : ""}.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">Not connected yet</p>
              <p className="text-slate-500 mt-0.5">Follow the steps below. It takes about five minutes.</p>
            </>
          )}
          {!migrated && <p className="text-amber-700 mt-2">Run <code>0023_calendar_sync.sql</code> in Supabase first.</p>}
          {!secretSet && (
            <p className="text-amber-700 mt-2">
              Add <code>CALENDAR_SYNC_SECRET</code> to the Tracker on Vercel (any long random value), then redeploy.
            </p>
          )}
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-3">
        <h2 className="font-semibold">Set it up</h2>
        <ol className="flex flex-col gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 text-xs font-semibold grid place-items-center shrink-0">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold text-sm">Script</h2>
          <button
            disabled={!script}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(script);
                toast("Script copied");
              } catch {
                toast("Select the script and copy it");
              }
            }}
            className="text-xs font-medium border border-slate-300 dark:border-slate-600 px-2.5 py-1 rounded-md flex items-center gap-1.5 disabled:opacity-50"
          >
            {script ? <Copy className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />} Copy script
          </button>
        </div>
        <pre className="text-xs leading-relaxed p-5 overflow-x-auto max-h-96 bg-slate-50 dark:bg-slate-950">{script || "Loading…"}</pre>
      </section>
    </div>
  );
}
