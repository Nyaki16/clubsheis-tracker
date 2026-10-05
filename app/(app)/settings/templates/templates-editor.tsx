"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { PACKAGES, PHASES, TOOLS, type FlowTemplate, type PackageId, type PhaseId } from "@/lib/flow";
import type { Profile } from "@/lib/types";
import { addTemplateTask, deleteTemplateTask, moveTemplateTask, updateTemplateTask } from "@/app/actions/flow";
import { PhaseDot, useToast } from "@/components/flow/ui";
import { MigrationNotice } from "@/components/flow/migration-notice";

const control = "text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2 py-1";

export default function TemplatesEditor({
  templates,
  profiles,
  migrated,
}: {
  templates: FlowTemplate[];
  profiles: Profile[];
  migrated: boolean;
}) {
  const [pkg, setPkg] = useState<PackageId>("page");
  const rows = templates.filter((t) => t.package === pkg);

  return (
    <div className="flex flex-col gap-5">
      {!migrated && <MigrationNotice />}
      <header>
        <h1 className="text-2xl font-bold">Package templates</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">The tasks each package issues when you add a client.</p>
      </header>

      <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {PACKAGES.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={pkg === p.id}
            onClick={() => setPkg(p.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${pkg === p.id ? "border-purple-600 text-slate-900 dark:text-white" : "border-transparent text-slate-500"}`}
          >
            {p.label} <span className="text-xs text-slate-400 tabular-nums">{templates.filter((t) => t.package === p.id).length}</span>
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-4 py-2.5">
        Edits apply to clients you add from now on. Existing clients keep their task lists, and you can still add one-off tasks on a client&apos;s page.
      </p>

      {PHASES.map((ph) => {
        const list = rows.filter((t) => t.phase === ph.id).sort((a, b) => a.position - b.position);
        return (
          <section key={ph.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <PhaseDot phase={ph.id} /> {ph.label}
              </h2>
              <span className="text-xs text-slate-400 tabular-nums">{list.length} tasks</span>
            </div>
            {list.map((t, i) => (
              <TemplateRow key={t.id} row={t} first={i === 0} last={i === list.length - 1} profiles={profiles} />
            ))}
            <AddRow pkg={pkg} phase={ph.id} label={ph.label} disabled={!migrated} />
          </section>
        );
      })}
    </div>
  );
}

function TemplateRow({ row, first, last, profiles }: { row: FlowTemplate; first: boolean; last: boolean; profiles: Profile[] }) {
  const [title, setTitle] = useState(row.title);
  useEffect(() => setTitle(row.title), [row.title]);
  const [, start] = useTransition();
  const toast = useToast();
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_170px_150px_auto] items-center gap-2 px-4 sm:px-5 py-2 border-t border-slate-100 dark:border-slate-800">
      <div className="flex flex-col">
        <button aria-label="Move up" disabled={first} onClick={() => start(() => moveTemplateTask(row.id, -1))} className="text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button aria-label="Move down" disabled={last} onClick={() => start(() => moveTemplateTask(row.id, 1))} className="text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
      <input
        aria-label="Task name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== row.title && start(() => updateTemplateTask(row.id, { title }))}
        className="text-sm bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-purple-500 rounded-md px-2 py-1 outline-none"
      />
      <select
        aria-label="Default owner"
        value={row.default_assignee_id ?? ""}
        onChange={(e) => start(() => updateTemplateTask(row.id, { default_assignee_id: e.target.value || null }))}
        className={`${control} col-start-2 sm:col-start-auto`}
      >
        <option value="">Client&apos;s lead</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select
        aria-label="Built-in tool"
        value={row.tool ?? ""}
        onChange={(e) => start(() => updateTemplateTask(row.id, { tool: e.target.value || null }))}
        className={`${control} col-start-2 sm:col-start-auto`}
      >
        <option value="">No tool</option>
        {TOOLS.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <button
        aria-label={`Remove ${row.title}`}
        onClick={() =>
          start(async () => {
            await deleteTemplateTask(row.id);
            toast(`Removed "${row.title}"`);
          })
        }
        className="row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto text-slate-400 hover:text-rose-600 p-1"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function AddRow({ pkg, phase, label, disabled }: { pkg: PackageId; phase: PhaseId; label: string; disabled: boolean }) {
  const [v, setV] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex gap-2 px-4 sm:px-5 py-2.5 border-t border-slate-100 dark:border-slate-800"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        start(async () => {
          await addTemplateTask(pkg, phase, v);
          setV("");
        });
      }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        disabled={disabled}
        placeholder={`Add a task to ${label}`}
        aria-label={`New template task in ${label}`}
        className="flex-1 min-w-0 text-sm border border-dashed border-slate-300 dark:border-slate-600 focus:border-solid focus:border-purple-500 bg-transparent rounded-md px-2.5 py-1.5 outline-none"
      />
      <button disabled={pending || disabled} className="text-xs font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md disabled:opacity-50">
        Add
      </button>
    </form>
  );
}
