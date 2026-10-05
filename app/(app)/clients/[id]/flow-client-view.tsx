"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, FolderOpen, Pencil } from "lucide-react";
import { PACKAGES, PHASES, currentPhase, isDone, packageLabel, sortFlowTasks, type FlowTemplate, type PackageId, type PhaseId, type PricingTier } from "@/lib/flow";
import type { Client, Profile, Task } from "@/lib/types";
import { deleteTask, updateTaskStatus } from "@/app/actions/tasks";
import { addFlowTask, restoreTask, startFlow } from "@/app/actions/flow";
import Avatar from "@/components/avatar";
import { FlowTaskRow, PhaseDot, ProgressBar, useToast } from "@/components/flow/ui";
import TaskDrawer from "@/components/flow/task-drawer";
import { EditClientModal } from "@/components/flow/client-modals";
import { MigrationNotice } from "@/components/flow/migration-notice";

const fmtCall = (d: string) =>
  new Date(d).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function FlowClientView({
  client,
  tasks,
  profiles,
  templates,
  tiers,
  migrated,
}: {
  client: Client;
  tasks: Task[];
  profiles: Profile[];
  templates: FlowTemplate[];
  tiers: PricingTier[];
  migrated: boolean;
}) {
  const toast = useToast();
  const [, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [nowMs] = useState(() => Date.now());

  const sorted = sortFlowTasks(tasks);
  const done = tasks.filter(isDone).length;
  const now = currentPhase(tasks);
  const phases = PHASES.filter((p) => tasks.some((t) => t.phase === p.id));
  const lead = profiles.find((p) => p.id === client.lead_id);
  const owner = (id: string | null) => profiles.find((p) => p.id === id);
  const callUpcoming = client.call_at && new Date(client.call_at) > new Date();
  const clockDay = client.clock_started_on
    ? Math.min(14, Math.round((nowMs - new Date(client.clock_started_on).getTime()) / 864e5) + 1)
    : null;
  const openTask = tasks.find((t) => t.id === open);

  function removeTask(t: Task) {
    const row = { ...t } as Record<string, unknown>;
    delete row.updated_at;
    start(async () => {
      await deleteTask(t.id);
      toast(`Deleted "${t.title}"`, () => start(() => restoreTask(row)));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/clients" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">← All clients</Link>
      {!migrated && <MigrationNotice />}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            {client.business_name ? <span>{client.business_name}</span> : (
              <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:underline">Add business name</button>
            )}
            {migrated && (
              <button
                onClick={() => setEditing(true)}
                title="Change package"
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${
                  client.package === "lead" ? "bg-amber-50 text-amber-700 border-transparent dark:bg-amber-500/15 dark:text-amber-300" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                }`}
              >
                {client.package === "lead" ? "Choose package" : packageLabel(client.package)} ▾
              </button>
            )}
            {clockDay && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 tabular-nums">
                Day {clockDay} of 14
              </span>
            )}
            {lead && (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <Avatar name={lead.name} url={lead.avatar_url} size="sm" /> Lead: {lead.name}
              </span>
            )}
          </div>
          {client.call_at && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>
                {callUpcoming ? "Discovery call booked" : "Discovery call"}: <b className="font-semibold">{client.call_title}</b> · {fmtCall(client.call_at)}
              </span>
              {!callUpcoming && client.call_notes_url && (
                <a href={client.call_notes_url} target="_blank" rel="noopener noreferrer" className="underline">Notes by Gemini</a>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {client.email ? <span>{client.email}</span> : <span className="font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">No email yet</span>}
            {client.phone && <span>· {client.phone}</span>}
            {client.google_drive_url ? (
              <a href={client.google_drive_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-0.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                <FolderOpen className="w-3.5 h-3.5" /> Open Drive folder
              </a>
            ) : (
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                <FolderOpen className="w-3.5 h-3.5" /> Add Drive folder
              </button>
            )}
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Pencil className="w-3 h-3" /> Edit details
            </button>
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ProgressBar done={done} total={tasks.length} className="w-40" />
            <span className="tabular-nums">{done}/{tasks.length} tasks</span>
          </div>
        )}
      </header>

      {!tasks.length && migrated && <StartFlow client={client} templates={templates} />}

      {phases.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
          {phases.map((ph) => {
            const ts = tasks.filter((t) => t.phase === ph.id);
            const d = ts.filter(isDone).length;
            const complete = d === ts.length;
            return (
              <button
                key={ph.id}
                onClick={() => document.getElementById(`phase-${ph.id}`)?.scrollIntoView({ behavior: "smooth" })}
                className={`text-left bg-white dark:bg-slate-900 border rounded-lg p-3 flex flex-col gap-2 ${
                  ph.id === now && !complete ? "border-purple-500 ring-2 ring-purple-500/15" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <PhaseDot phase={ph.id} />
                  {ph.label}
                  {complete ? (
                    <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-wider text-emerald-600">Done</span>
                  ) : ph.id === now ? (
                    <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-wider text-purple-600">Now</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                  <ProgressBar done={d} total={ts.length} className="flex-1" />
                  {d}/{ts.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {phases.map((ph) => {
        const ts = sorted.filter((t) => t.phase === ph.id);
        return (
          <section key={ph.id} id={`phase-${ph.id}`} className="scroll-mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5">
              <h2 className="flex items-center gap-2 font-semibold">
                <PhaseDot phase={ph.id} />
                {ph.label}
              </h2>
              <span className="text-xs text-slate-400 tabular-nums">{ts.filter(isDone).length} of {ts.length} done</span>
            </div>
            {ts.map((t) => (
              <FlowTaskRow
                key={t.id}
                task={t}
                owner={owner(t.assignee_id)}
                meta={<span>{owner(t.assignee_id)?.name ?? "Unassigned"}</span>}
                onOpen={() => setOpen(t.id)}
                onStatus={(s) => start(() => updateTaskStatus(t.id, s))}
                onDelete={() => removeTask(t)}
              />
            ))}
            <AddTask clientId={client.id} phase={ph.id} label={ph.label} defaultAssignee={client.lead_id} />
          </section>
        );
      })}

      {openTask && (
        <TaskDrawer
          task={openTask}
          client={client}
          clientTasks={tasks}
          profiles={profiles}
          tiers={tiers}
          onClose={() => setOpen(null)}
          onOpenTask={setOpen}
          onEditClient={() => { setOpen(null); setEditing(true); }}
        />
      )}
      {editing && (
        <EditClientModal client={client} tasks={tasks} templates={templates} profiles={profiles} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

function AddTask({ clientId, phase, label, defaultAssignee }: { clientId: string; phase: PhaseId; label: string; defaultAssignee: string | null }) {
  const [v, setV] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <form
      className="flex gap-2 px-4 sm:px-5 py-2.5 border-t border-slate-100 dark:border-slate-800"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        start(async () => {
          await addFlowTask(clientId, phase, v, defaultAssignee);
          setV("");
          toast("Task added");
        });
      }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={`Add a task to ${label}`}
        aria-label={`New task in ${label}`}
        className="flex-1 min-w-0 text-sm border border-dashed border-slate-300 dark:border-slate-600 focus:border-solid focus:border-purple-500 bg-transparent rounded-md px-2.5 py-1.5 outline-none"
      />
      <button disabled={pending} className="text-xs font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md disabled:opacity-50">
        Add
      </button>
    </form>
  );
}

function StartFlow({ client, templates }: { client: Client; templates: FlowTemplate[] }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <section className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">Start the client flow</h2>
        <p className="text-sm text-slate-500">Pick {client.name}&apos;s package and the tasks are issued from its template.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {PACKAGES.map((p) => (
          <button
            key={p.id}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await startFlow(client.id, p.id as PackageId);
                toast(`${r.issued} tasks issued from ${p.label}`);
              })
            }
            className="text-left rounded-lg border border-slate-300 dark:border-slate-700 hover:border-purple-500 px-3 py-2 disabled:opacity-50"
          >
            <span className="block text-sm font-semibold">{p.label}</span>
            <span className="block text-xs text-slate-400">
              {templates.filter((t) => t.package === p.id).length} tasks · {p.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
