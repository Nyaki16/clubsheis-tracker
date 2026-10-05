"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, Trash2, X } from "lucide-react";
import type { TaskStatusId } from "@/lib/constants";
import { PHASES, TECH_CHECKS, TOOL_INPUTS, isDone, packageLabel } from "@/lib/flow";
import type { Client, Profile, Task } from "@/lib/types";
import { deleteTask, updateTask } from "@/app/actions/tasks";
import { restoreTask, updateToolState } from "@/app/actions/flow";
import { PhaseDot, StatusSelect, useToast } from "./ui";

const field = "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5 text-sm";
const label = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5";

export default function TaskDrawer({
  task,
  client,
  clientTasks,
  profiles,
  onClose,
}: {
  task: Task;
  client: Client;
  clientTasks: Task[];
  profiles: Profile[];
  onClose: () => void;
}) {
  const [, startTransition] = useTransition();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [notes, setNotes] = useState(task.notes);
  useEffect(() => setNotes(task.notes), [task.id, task.notes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const phase = PHASES.find((p) => p.id === task.phase);
  const save = (u: Parameters<typeof updateTask>[1]) => startTransition(() => updateTask(task.id, u));

  function remove() {
    const row = { ...task } as Record<string, unknown>;
    delete row.updated_at;
    startTransition(async () => {
      await deleteTask(task.id);
      onClose();
      toast(`Deleted "${task.title}"`, () => startTransition(() => restoreTask(row)));
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        className="w-full max-w-xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <PhaseDot phase={task.phase} />
            <Link href={`/clients/${client.id}`} className="hover:text-slate-700 dark:hover:text-slate-200">
              {client.name}
            </Link>
            <span>·</span>
            <span>{phase?.label ?? "Task"}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">{task.title}</h2>
            <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={label} htmlFor="t-status">Status</label>
              <StatusSelect id="t-status" value={task.status} onChange={(s: TaskStatusId) => save({ status: s })} />
            </div>
            <div>
              <label className={label} htmlFor="t-owner">Owner</label>
              <select id="t-owner" className={field} value={task.assignee_id ?? ""} onChange={(e) => save({ assignee_id: e.target.value || null })}>
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="t-due">Due</label>
              <input id="t-due" type="date" className={field} value={task.due_date ?? ""} onChange={(e) => save({ due_date: e.target.value || null })} />
            </div>
          </div>

          <ToolPanel task={task} client={client} clientTasks={clientTasks} />

          <div>
            <label className={label} htmlFor="t-notes">Notes</label>
            <textarea
              id="t-notes"
              className={`${field} min-h-[80px]`}
              placeholder="Anything the team should know"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== task.notes && save({ notes })}
            />
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-3 flex items-center justify-between gap-3">
          {confirming ? (
            <>
              <span className="text-xs text-rose-600">Delete this task and anything generated in it?</span>
              <span className="flex gap-2">
                <button onClick={remove} className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-md">Delete</button>
                <button onClick={() => setConfirming(false)} className="text-xs font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md">Cancel</button>
              </span>
            </>
          ) : (
            <>
              <button onClick={() => setConfirming(true)} className="text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-2 py-1.5 rounded-md flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete task
              </button>
              {isDone(task) ? (
                <button onClick={() => save({ status: "in_progress" })} className="text-sm font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md">Reopen</button>
              ) : (
                <button onClick={() => save({ status: "closed_out" })} className="text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 rounded-md">Mark closed out</button>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Built-in tools ──────────────────────────────────────────────────────────

function ToolBox({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 text-sm font-semibold">
        <Sparkles className="w-4 h-4" />
        {title}
        {right && <span className="ml-auto text-xs font-medium opacity-80">{right}</span>}
      </div>
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Soon({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-md px-3 py-2">{children}</p>;
}

function useToolField(task: Task, key: string) {
  const [v, setV] = useState(String(task.tool_state?.[key] ?? ""));
  useEffect(() => setV(String(task.tool_state?.[key] ?? "")), [task.id, task.tool_state, key]);
  const [, start] = useTransition();
  const commit = () => {
    if (v !== String(task.tool_state?.[key] ?? "")) start(() => updateToolState(task.id, { [key]: v }));
  };
  return { value: v, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value), onBlur: commit };
}

function InputChips({ task, clientTasks }: { task: Task; clientTasks: Task[] }) {
  const needs = (TOOL_INPUTS[task.title] ?? ["Yellow Sheet"])
    .map((n) => ({ n, src: clientTasks.find((t) => t.title === n) }))
    .filter((x) => x.src);
  if (!needs.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-slate-500">Uses as input:</p>
      <div className="flex flex-wrap gap-1.5">
        {needs.map(({ n, src }) => {
          const ok = src && (isDone(src) || src.tool_state?.state === "approved" || src.tool_state?.state === "submitted");
          return (
            <span
              key={n}
              className={`text-xs px-2 py-0.5 rounded-full ${ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "border border-dashed border-slate-300 dark:border-slate-600 text-slate-400"}`}
            >
              {ok ? "✓" : "○"} {n}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ToolPanel({ task, client, clientTasks }: { task: Task; client: Client; clientTasks: Task[] }) {
  const [, start] = useTransition();
  const toast = useToast();
  const need = useToolField(task, "need");
  const transcript = useToolField(task, "transcript");
  const link = useToolField(task, "link");
  const offer = useToolField(task, "offer");
  const business = useToolField(task, "business");
  const voice = useToolField(task, "voice");

  switch (task.tool) {
    case "discovery":
      return (
        <ToolBox title="Discovery call">
          {client.call_at && (
            <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 rounded-md px-3 py-2">
              Call on {new Date(client.call_at).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              {client.call_notes_url && (
                <>
                  {" · "}
                  <a className="underline" href={client.call_notes_url} target="_blank" rel="noopener noreferrer">Notes by Gemini</a>
                </>
              )}
            </p>
          )}
          <div>
            <label className={label} htmlFor="d-need">What they need</label>
            <textarea id="d-need" className={`${field} min-h-[70px]`} placeholder="Goals, problems, what they asked for" {...need} />
          </div>
          <div>
            <label className={label} htmlFor="d-transcript">Call notes or transcript</label>
            <textarea id="d-transcript" className={`${field} min-h-[110px]`} placeholder="Paste the transcript or your notes" {...transcript} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="d-link">Recording / transcript link</label>
              <input id="d-link" className={field} placeholder="Drive, Fathom, Zoom…" {...link} />
            </div>
            <div>
              <label className={label} htmlFor="d-lead">Lead status</label>
              <select
                id="d-lead"
                className={field}
                value={String(task.tool_state?.lead ?? "")}
                onChange={(e) => start(() => updateToolState(task.id, { lead: e.target.value }, task.status === "planning" ? "in_progress" : undefined))}
              >
                <option value="">Choose…</option>
                <option>Good fit</option>
                <option>Not a fit</option>
                <option>Follow up</option>
              </select>
            </div>
          </div>
          <Soon>Generating the proposal from these notes switches on in the next update.</Soon>
        </ToolBox>
      );

    case "checklist": {
      const checks = (task.tool_state?.checks as boolean[] | undefined) ?? TECH_CHECKS.map(() => false);
      const n = checks.filter(Boolean).length;
      return (
        <ToolBox title="Checklist" right={`${n}/${TECH_CHECKS.length}`}>
          <div className="flex flex-col">
            {TECH_CHECKS.map((c, i) => (
              <label key={c.label} className="flex gap-3 items-start py-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 accent-purple-600"
                  checked={!!checks[i]}
                  onChange={(e) => {
                    const next = TECH_CHECKS.map((_, k) => (k === i ? e.target.checked : !!checks[k]));
                    const all = next.every(Boolean);
                    const status = all ? "closed_out" : next.some(Boolean) && (task.status === "planning" || isDone(task)) ? "in_progress" : undefined;
                    start(() => updateToolState(task.id, { checks: next }, status));
                    if (all) toast(`${task.title} complete`);
                  }}
                />
                <span>
                  <span className={`block text-sm font-medium ${checks[i] ? "line-through text-slate-400" : ""}`}>{c.label}</span>
                  <span className="block text-xs text-slate-400">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </ToolBox>
      );
    }

    case "yellow": {
      const submitted = task.tool_state?.state === "submitted";
      const feeds = clientTasks.filter((t) => (TOOL_INPUTS[t.title] ?? []).includes("Yellow Sheet"));
      return (
        <ToolBox title="Yellow Sheet" right={submitted ? "Received" : "Waiting on client"}>
          <p className="text-xs text-slate-500">
            The client fills this in once they&apos;ve paid for Ghutte. A link to send them arrives in the next update. For now, paste their answers below.
          </p>
          <div>
            <label className={label} htmlFor="y-offer">Their offer</label>
            <textarea id="y-offer" className={`${field} min-h-[70px]`} placeholder="What they sell, price, what's included" {...offer} />
          </div>
          <div>
            <label className={label} htmlFor="y-business">Their business</label>
            <textarea id="y-business" className={`${field} min-h-[70px]`} placeholder="Who they are, who they serve, their story" {...business} />
          </div>
          <div>
            <label className={label} htmlFor="y-voice">Brand voice</label>
            <textarea id="y-voice" className={`${field} min-h-[70px]`} placeholder="How they sound, words they use and avoid" {...voice} />
          </div>
          {submitted ? (
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              ✓ Yellow Sheet in. Feeds {feeds.length} task{feeds.length === 1 ? "" : "s"}: {feeds.map((t) => t.title).join(", ")}
            </p>
          ) : (
            <button
              disabled={!offer.value.trim()}
              onClick={() => start(() => updateToolState(task.id, { state: "submitted", offer: offer.value, business: business.value, voice: voice.value }, "closed_out"))}
              className="self-start text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
            >
              Mark as received
            </button>
          )}
        </ToolBox>
      );
    }

    case "proposal":
      return (
        <ToolBox title="Proposal PDF + email">
          <Soon>
            The proposal generator arrives in the next update. It reads the discovery notes, picks tiers from your <Link className="underline" href="/settings/pricing">Pricing</Link> page, builds the 8-page PDF and sends it to {client.email ?? "the client's email"}.
          </Soon>
        </ToolBox>
      );

    case "account":
      return (
        <ToolBox title="Ghutte setup">
          <Soon>Creating the Ghutte sub-account from here arrives in the next update. Until then, create it in Ghutte and close this task.</Soon>
        </ToolBox>
      );

    case "gen":
      return (
        <ToolBox title="AI generator" right="Claude">
          <InputChips task={task} clientTasks={clientTasks} />
          <Soon>Generating {task.title.toLowerCase()} for {client.business_name || client.name} ({packageLabel(client.package)}) switches on in the next update.</Soon>
        </ToolBox>
      );

    default:
      return null;
  }
}
