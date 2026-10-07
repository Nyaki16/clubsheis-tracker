"use client";

import { useState, useTransition } from "react";
import { Pencil, RefreshCw } from "lucide-react";
import Markdown from "@/components/flow/markdown";
import { DebbieAvatar } from "@/components/debbie/debbie-chat";
import { useToast } from "@/components/flow/ui";
import { setNewClientTarget, writeBriefingNow } from "@/app/actions/dashboard";
import type { Briefing } from "@/lib/briefing";

export function TargetEditor({ target, canEdit }: { target: number; canEdit: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(target));
  const [pending, start] = useTransition();
  if (!canEdit) return <span className="text-xs text-slate-500">Target: {target} a month</span>;
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1">
        Target: {target} a month <Pencil className="w-3 h-3" />
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-1.5 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            await setNewClientTarget(Number(value));
            toast(`Target set to ${value} new clients a month`);
            setEditing(false);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Couldn't save.");
          }
        });
      }}
    >
      <input autoFocus type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)} className="w-16 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded px-1.5 py-0.5" aria-label="Monthly target" />
      <span>a month</span>
      <button disabled={pending} className="font-semibold text-purple-700 dark:text-purple-300">Save</button>
      <button type="button" onClick={() => setEditing(false)} className="text-slate-400">Cancel</button>
    </form>
  );
}

export function BriefingCard({ briefing }: { briefing: Briefing | null }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <section className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold flex items-center gap-2">
          <DebbieAvatar size={22} /> Debbie&apos;s weekly briefing
        </h2>
        <span className="flex items-center gap-2 text-xs text-slate-400">
          {briefing && `Written ${new Date(briefing.created_at).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  await writeBriefingNow();
                  toast("Debbie's briefing is fresh");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Couldn't write the briefing.");
                }
              })
            }
            className="inline-flex items-center gap-1 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${pending ? "animate-spin" : ""}`} /> {pending ? "Writing… about 30 seconds" : briefing ? "Rewrite" : "Write it now"}
          </button>
        </span>
      </div>
      {briefing ? (
        <Markdown text={briefing.content} />
      ) : (
        <p className="text-sm text-slate-500">
          Every Monday morning Debbie writes the team a short briefing: where we are against the target, the wins, this week&apos;s focus and what to watch. Click
          Write it now for this week&apos;s.
        </p>
      )}
    </section>
  );
}
