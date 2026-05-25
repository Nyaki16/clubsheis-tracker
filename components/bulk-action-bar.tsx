"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { TASK_STATUSES } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { bulkDeleteTasks, bulkUpdateTasks } from "@/app/actions/tasks";

// Floating bulk action bar — shows when one or more tasks are selected.
// Used by /daily and /clients/[id] so the multi-select UX is identical.
export default function BulkActionBar({
  selectedIds,
  profiles,
  onClear,
}: {
  selectedIds: string[];
  profiles: Profile[];
  onClear: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<"assignee" | "status" | "due" | null>(null);
  const [dueDraft, setDueDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const count = selectedIds.length;

  function run(updates: Parameters<typeof bulkUpdateTasks>[1]) {
    startTransition(async () => {
      await bulkUpdateTasks(selectedIds, updates);
      setOpen(null);
      onClear();
    });
  }

  function runDelete() {
    if (!confirm(`Delete ${count} ${count === 1 ? "task" : "tasks"}?`)) return;
    startTransition(async () => {
      await bulkDeleteTasks(selectedIds);
      onClear();
    });
  }

  return (
    <div
      ref={ref}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-2.5 flex items-center gap-2"
    >
      <span className="text-sm font-medium pr-2 border-r border-slate-700">
        {count} selected
      </span>

      <div className="relative">
        <button
          onClick={() => setOpen(open === "assignee" ? null : "assignee")}
          disabled={pending}
          className="text-xs px-2.5 py-1.5 rounded hover:bg-slate-800 disabled:opacity-50"
        >
          Assign…
        </button>
        {open === "assignee" && (
          <div className="absolute bottom-full mb-2 left-0 bg-white text-slate-900 border border-slate-200 rounded-lg shadow-lg w-48 py-1">
            <button
              onClick={() => run({ assignee_id: null })}
              className="w-full text-left text-xs px-3 py-1.5 hover:bg-slate-100"
            >
              Unassigned
            </button>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => run({ assignee_id: p.id })}
                className="w-full text-left text-xs px-3 py-1.5 hover:bg-slate-100"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen(open === "status" ? null : "status")}
          disabled={pending}
          className="text-xs px-2.5 py-1.5 rounded hover:bg-slate-800 disabled:opacity-50"
        >
          Status…
        </button>
        {open === "status" && (
          <div className="absolute bottom-full mb-2 left-0 bg-white text-slate-900 border border-slate-200 rounded-lg shadow-lg w-44 py-1">
            {TASK_STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => run({ status: s.id })}
                className="w-full text-left text-xs px-3 py-1.5 hover:bg-slate-100"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen(open === "due" ? null : "due")}
          disabled={pending}
          className="text-xs px-2.5 py-1.5 rounded hover:bg-slate-800 disabled:opacity-50"
        >
          Due date…
        </button>
        {open === "due" && (
          <div className="absolute bottom-full mb-2 left-0 bg-white text-slate-900 border border-slate-200 rounded-lg shadow-lg p-3 w-56">
            <input
              type="date"
              autoFocus
              value={dueDraft}
              onChange={(e) => setDueDraft(e.target.value)}
              className="w-full border border-slate-200 rounded px-2 py-1 text-xs mb-2"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  run({ due_date: dueDraft || null });
                  setDueDraft("");
                }}
                disabled={!dueDraft}
                className="flex-1 bg-slate-900 text-white text-xs px-2 py-1 rounded disabled:opacity-40"
              >
                Set
              </button>
              <button
                onClick={() => {
                  run({ due_date: null });
                  setDueDraft("");
                }}
                className="text-xs px-2 py-1 rounded text-slate-600 hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={runDelete}
        disabled={pending}
        className="text-xs px-2.5 py-1.5 rounded hover:bg-rose-600 text-rose-300 hover:text-white disabled:opacity-50"
      >
        Delete
      </button>

      <button
        onClick={onClear}
        disabled={pending}
        className="ml-1 p-1.5 rounded hover:bg-slate-800 disabled:opacity-50"
        aria-label="Clear selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
