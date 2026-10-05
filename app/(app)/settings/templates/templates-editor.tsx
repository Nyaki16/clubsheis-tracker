"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { PHASES, TOOLS, type FlowTemplate, type PackageDef, type PackageId, type PhaseId } from "@/lib/flow";
import type { Profile } from "@/lib/types";
import {
  addTemplateTask,
  createPackage,
  deletePackage,
  deleteTemplateTask,
  moveTemplateTask,
  updatePackage,
  updateTemplateTask,
} from "@/app/actions/flow";
import { PhaseDot, useToast } from "@/components/flow/ui";
import { MigrationNotice } from "@/components/flow/migration-notice";
import { usePackages } from "@/components/flow/packages-context";

const control = "text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2 py-1";
const field = "w-full text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5 outline-none focus:border-purple-500";

export default function TemplatesEditor({
  templates,
  profiles,
  migrated,
}: {
  templates: FlowTemplate[];
  profiles: Profile[];
  migrated: boolean;
}) {
  const packages = usePackages();
  const [picked, setPicked] = useState<PackageId | "new">("page");
  const current = packages.find((p) => p.id === picked) ?? (picked === "new" ? null : packages[0]);
  const pkg = current?.id ?? "";
  const rows = templates.filter((t) => t.package === pkg);

  return (
    <div className="flex flex-col gap-5">
      {!migrated && <MigrationNotice />}
      <header>
        <h1 className="text-2xl font-bold">Package templates</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          The tasks each package issues: for a new client&apos;s flow, and for New job. One list, used everywhere.
        </p>
      </header>

      <div role="tablist" aria-label="Packages" className="flex flex-wrap gap-1.5">
        {packages.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={pkg === p.id}
            onClick={() => setPicked(p.id)}
            className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap ${
              pkg === p.id
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400"
            }`}
          >
            {p.label} <span className={`text-xs tabular-nums ${pkg === p.id ? "opacity-60" : "text-slate-400"}`}>{templates.filter((t) => t.package === p.id).length}</span>
          </button>
        ))}
        <button
          role="tab"
          aria-selected={picked === "new"}
          disabled={!migrated}
          onClick={() => setPicked("new")}
          className={`px-3 py-1.5 text-sm rounded-full border border-dashed flex items-center gap-1 disabled:opacity-50 ${
            picked === "new" ? "border-purple-500 text-purple-700 dark:text-purple-300" : "border-slate-300 dark:border-slate-600 text-slate-500 hover:border-purple-400"
          }`}
        >
          <Plus className="w-3.5 h-3.5" /> New package
        </button>
      </div>

      {picked === "new" || !current ? (
        <NewPackage onCreated={(id) => setPicked(id)} onCancel={() => setPicked(packages[0]?.id ?? "page")} />
      ) : (
        <>
          <PackageDetails key={current.id} p={current} onDeleted={() => setPicked(packages[0]?.id ?? "page")} />

          <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-4 py-2.5">
            Edits apply to clients and jobs you add from now on. A new client gets every phase. A client who&apos;s already onboarded gets only{" "}
            <b>Production</b> and <b>Delivery</b> when you add this package through New job, e.g. next month&apos;s cycle.
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
        </>
      )}
    </div>
  );
}

function NewPackage({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ label: "", short: "", description: "", job_name: "", withSetup: true });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => ({ ...x, [k]: k === "withSetup" ? e.target.checked : e.target.value }));
  return (
    <form
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-4 max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.label.trim()) return;
        start(async () => {
          try {
            const r = await createPackage(f);
            toast(`${f.label.trim()} created. Now add its tasks.`);
            router.refresh();
            onCreated(r.id);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Couldn't create the package.");
          }
        });
      }}
    >
      <h2 className="font-semibold">New package</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm flex flex-col gap-1 sm:col-span-2">
          <span className="font-medium">Name</span>
          <input autoFocus required value={f.label} onChange={set("label")} placeholder="e.g. Small Business — Platinum" className={field} />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="font-medium">Short name <span className="text-slate-400 font-normal">(badges)</span></span>
          <input value={f.short} onChange={set("short")} placeholder="e.g. Platinum" className={field} />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="font-medium">Default job name</span>
          <input value={f.job_name} onChange={set("job_name")} placeholder="e.g. Platinum — Monthly cycle" className={field} />
        </label>
        <label className="text-sm flex flex-col gap-1 sm:col-span-2">
          <span className="font-medium">Price &amp; what&apos;s included</span>
          <input value={f.description} onChange={set("description")} placeholder="e.g. R9,500/mo · Strategy + 20 posts/mo" className={field} />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={f.withSetup} onChange={set("withSetup")} className="mt-0.5 w-4 h-4 accent-purple-600" />
        <span>
          Start with the usual <b>Sales</b> and <b>Onboarding</b> tasks
          <span className="block text-xs text-slate-500">Copied from Full Build. Clients who are already onboarded skip them.</span>
        </span>
      </label>
      <div className="flex gap-2">
        <button disabled={pending || !f.label.trim()} className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-2 rounded-lg disabled:opacity-50">
          {pending ? "Creating…" : "Create package"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600">
          Cancel
        </button>
      </div>
    </form>
  );
}

function PackageDetails({ p, onDeleted }: { p: PackageDef; onDeleted: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ label: p.label, short: p.short, description: p.description, job_name: p.job_name ?? "" });
  const save = (k: keyof typeof f) => () => {
    if (f[k] === ((k === "job_name" ? p.job_name ?? "" : p[k]) as string)) return;
    start(async () => {
      try {
        await updatePackage(p.id, { ...f, [k]: f[k] });
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  };
  const input = (k: keyof typeof f, label: string, placeholder: string, wide = false) => (
    <label className={`text-xs flex flex-col gap-1 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium text-slate-500">{label}</span>
      <input value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} onBlur={save(k)} placeholder={placeholder} className={field} />
    </label>
  );
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col gap-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {input("label", "Name", "Package name", true)}
        {input("short", "Short name (badges)", p.label)}
        {input("job_name", "Default job name (New job)", p.label)}
        {input("description", "Price & what's included", "e.g. R5,500/mo · Strategy + 12 posts", true)}
      </div>
      {p.id !== "lead" && (
        <button
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Delete ${p.label} and its task template? Clients on it must be moved first.`)) return;
            start(async () => {
              try {
                await deletePackage(p.id);
                toast(`${p.label} deleted`);
                onDeleted();
                router.refresh();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Couldn't delete.");
              }
            });
          }}
          className="self-start text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete package
        </button>
      )}
    </section>
  );
}

function TemplateRow({ row, first, last, profiles }: { row: FlowTemplate; first: boolean; last: boolean; profiles: Profile[] }) {
  const [title, setTitle] = useState(row.title);
  const [from, setFrom] = useState(row.title);
  if (row.title !== from) {
    setFrom(row.title);
    setTitle(row.title);
  }
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
