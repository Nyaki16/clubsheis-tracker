"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { TASK_STATUSES, type TaskStatusId } from "@/lib/constants";
import { PHASES, isDone, toolLabel } from "@/lib/flow";
import Avatar from "@/components/avatar";
import type { Profile, Task } from "@/lib/types";

// ── Toast with optional Undo ────────────────────────────────────────────────

type ToastFn = (msg: string, undo?: () => void) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback<ToastFn>((msg, undo) => {
    setToast({ msg, undo });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), undo ? 6000 : 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3"
        >
          {toast.msg}
          {toast.undo && (
            <button
              className="underline font-semibold"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

// ── Small pieces ───────────────────────────────────────────────────────────

export function StatusSelect({
  value,
  onChange,
  id,
  className = "",
}: {
  value: string;
  onChange: (s: TaskStatusId) => void;
  id?: string;
  className?: string;
}) {
  const s = TASK_STATUSES.find((x) => x.id === value) ?? TASK_STATUSES[0];
  return (
    <select
      id={id}
      aria-label="Status"
      value={value}
      onChange={(e) => onChange(e.target.value as TaskStatusId)}
      className={`text-xs font-semibold rounded-full border px-2.5 py-1 cursor-pointer max-w-full ${s.color} ${className}`}
    >
      {TASK_STATUSES.map((x) => (
        <option key={x.id} value={x.id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
          {x.label}
        </option>
      ))}
    </select>
  );
}

export function PhaseDot({ phase }: { phase: string | null }) {
  const p = PHASES.find((x) => x.id === phase);
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${p?.dot ?? "bg-slate-300"}`} />;
}

export function ToolTag({ tool }: { tool: string | null }) {
  const label = toolLabel(tool);
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-500/15 px-2 py-0.5 rounded-full whitespace-nowrap">
      <Sparkles className="w-3 h-3" />
      {label}
    </span>
  );
}

export function dueInfo(due: string | null) {
  if (!due) return { label: "No date", tone: "text-slate-400" };
  const today = new Date(new Date().toDateString());
  const d = new Date(due + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 864e5);
  if (diff < 0) return { label: `${-diff}d overdue`, tone: "text-rose-600 dark:text-rose-400 font-semibold" };
  if (diff === 0) return { label: "Today", tone: "text-amber-600 dark:text-amber-400 font-semibold" };
  if (diff === 1) return { label: "Tomorrow", tone: "text-slate-600 dark:text-slate-300" };
  return { label: d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }), tone: "text-slate-600 dark:text-slate-300" };
}

export function ProgressBar({ done, total, className = "" }: { done: number; total: number; className?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={`h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Debbie Recommends badge ─────────────────────────────────────────────────

export function DebbieBadge({ source }: { source?: Task["debbie_source"] }) {
  const tip = source?.quote ? `From ${source.meeting_title}: “${source.quote}”` : source?.meeting_title ?? "Recommended by Debbie";
  return (
    <span
      title={tip}
      className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-100 via-pink-100 to-purple-100 text-purple-800 dark:from-amber-500/20 dark:via-pink-500/20 dark:to-purple-500/20 dark:text-purple-200 whitespace-nowrap shrink-0"
    >
      <Sparkles className="w-3 h-3" /> Debbie Recommends
    </span>
  );
}

// ── Task row (Home + client page) ───────────────────────────────────────────

export function FlowTaskRow({
  task,
  meta,
  owner,
  onOpen,
  onStatus,
  onDelete,
}: {
  task: Task;
  meta: React.ReactNode;
  owner: Profile | undefined;
  onOpen: () => void;
  onStatus: (s: TaskStatusId) => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const done = isDone(task);
  const due = dueInfo(task.due_date);

  if (confirming) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-rose-50 dark:bg-rose-500/10 text-sm">
        <span>
          Delete <b>{task.title}</b>? This removes it and anything generated in it.
        </span>
        <span className="flex gap-2 shrink-0">
          <button onClick={onDelete} className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-md">
            Delete
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md">
            Cancel
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="group grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[160px_minmax(0,1fr)_auto_auto_24px_24px] items-center gap-x-3 gap-y-1.5 px-4 sm:px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <StatusSelect value={task.status} onChange={onStatus} className="row-start-2 sm:row-start-auto justify-self-start" />
      <button onClick={onOpen} className="min-w-0 text-left col-span-2 sm:col-span-1 row-start-1 sm:row-start-auto">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={`text-sm font-medium truncate ${done ? "text-slate-400 dark:text-slate-500" : ""}`}>{task.title}</span>
          {task.debbie_recommended && <DebbieBadge source={task.debbie_source} />}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 truncate">{meta}</span>
      </button>
      <span className="hidden sm:block">
        <ToolTag tool={task.tool} />
      </span>
      <span className={`text-xs whitespace-nowrap text-right row-start-2 sm:row-start-auto ${done ? "text-slate-400" : due.tone}`}>
        {done ? "Done" : due.label}
      </span>
      <span className="hidden sm:block" title={owner ? `${owner.name}${owner.job_title ? " · " + owner.job_title : ""}` : "Unassigned"}>
        <Avatar name={owner?.name ?? "?"} url={owner?.avatar_url} size="sm" />
      </span>
      <button
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${task.title}`}
        className="hidden sm:block opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-rose-600 p-0.5"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
