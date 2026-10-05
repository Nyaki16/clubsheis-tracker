"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
import { PHASES, currentPhase, isDone, packageLabel, sortFlowTasks, type FlowTemplate, type PricingTier } from "@/lib/flow";
import type { Client, Profile, Task } from "@/lib/types";
import { deleteTask, updateTaskStatus } from "@/app/actions/tasks";
import { restoreTask } from "@/app/actions/flow";
import Avatar from "@/components/avatar";
import { FlowTaskRow, PhaseDot, ProgressBar, dueInfo, useToast } from "@/components/flow/ui";
import TaskDrawer from "@/components/flow/task-drawer";
import { NewClientModal } from "@/components/flow/client-modals";
import { MigrationNotice } from "@/components/flow/migration-notice";

export default function HomeClient({
  clients,
  profiles,
  templates,
  tiers,
  tasksByClient,
  meId,
  migrated,
  calendarSync,
}: {
  clients: Client[];
  profiles: Profile[];
  templates: FlowTemplate[];
  tiers: PricingTier[];
  calendarSync: Record<string, unknown> | null;
  tasksByClient: Record<string, Task[]>;
  meId: string | null;
  migrated: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [who, setWho] = useState(meId ?? "");
  const [board, setBoard] = useState<"all" | "mine">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const person = profiles.find((p) => p.id === who);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const allTasks = useMemo(
    () => Object.entries(tasksByClient).flatMap(([cid, ts]) => ts.map((t) => ({ t, c: clientById.get(cid)! }))).filter((x) => x.c),
    [tasksByClient, clientById]
  );

  const today = new Date(new Date().toDateString());
  const weekEnd = new Date(today.getTime() + 7 * 864e5);
  const mine = allTasks
    .filter((x) => x.t.assignee_id === who && !isDone(x.t) && !x.c.is_past_lead)
    .sort((a, b) => (a.t.due_date ?? "9999").localeCompare(b.t.due_date ?? "9999"));
  const at = (d: string | null) => (d ? new Date(d + "T00:00:00") : null);
  const over = mine.filter((x) => { const d = at(x.t.due_date); return d && d < today; });
  const todayL = mine.filter((x) => { const d = at(x.t.due_date); return d && +d === +today; });
  const week = mine.filter((x) => { const d = at(x.t.due_date); return d && d > today && d <= weekEnd; });
  const later = mine.length - over.length - todayL.length - week.length;
  const clientCount = new Set([...over, ...todayL, ...week].map((x) => x.c.id)).size;

  const flowClients = clients.filter((c) => !c.is_past_lead && (tasksByClient[c.id]?.length ?? 0) > 0);
  const shown = board === "mine" ? flowClients.filter((c) => c.lead_id === who || (tasksByClient[c.id] ?? []).some((t) => t.assignee_id === who && !isDone(t))) : flowClients;
  const notStarted = clients.filter((c) => !c.is_past_lead && !(tasksByClient[c.id]?.length)).length;

  const openTask = open ? allTasks.find((x) => x.t.id === open) : null;
  const owner = (id: string | null) => profiles.find((p) => p.id === id);

  function removeTask(t: Task) {
    const row = { ...t } as Record<string, unknown>;
    delete row.updated_at;
    start(async () => {
      await deleteTask(t.id);
      toast(`Deleted "${t.title}"`, () => start(() => restoreTask(row)));
    });
  }

  const group = (label: string, list: typeof mine, tone = "") =>
    list.length > 0 && (
      <div>
        <p className={`flex items-center gap-2 px-4 sm:px-5 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider ${tone || "text-slate-400"}`}>
          {label} <span className="tabular-nums font-medium">{list.length}</span>
        </p>
        {list.map(({ t, c }) => (
          <FlowTaskRow
            key={t.id}
            task={t}
            owner={owner(t.assignee_id)}
            meta={
              <>
                <PhaseDot phase={t.phase} />
                <span className="truncate">{c.name}</span>
                <span>·</span>
                <span>{PHASES.find((p) => p.id === t.phase)?.label}</span>
              </>
            }
            onOpen={() => setOpen(t.id)}
            onStatus={(s) => start(() => updateTaskStatus(t.id, s))}
            onDelete={() => removeTask(t)}
          />
        ))}
      </div>
    );

  const first = person?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  return (
    <div className="flex flex-col gap-6">
      {!migrated && <MigrationNotice />}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">
            {today.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-2xl font-bold">
            {who === meId ? `${greeting}, ${first}` : `${first}'s tasks`}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {over.length + todayL.length + week.length} tasks due this week across {clientCount} clients
            {over.length ? `, ${over.length} overdue` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="who">Show tasks for</label>
          <select id="who" value={who} onChange={(e) => setWho(e.target.value)} className="text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5">
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === meId ? `Me (${p.name})` : p.name}
                {p.job_title ? ` · ${p.job_title}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => setNewOpen(true)}
            disabled={!migrated}
            className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> New client
          </button>
        </div>
      </header>

      <CalendarBar sync={calendarSync} upcoming={clients.filter((c) => !c.is_past_lead && !c.call_cancelled && c.call_at && new Date(c.call_at) > today).length} />

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden" aria-label="My tasks">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold">{who === meId ? "My tasks" : `${first}'s tasks`}</h2>
          {later > 0 && <span className="text-xs text-slate-400">{later} more due later</span>}
        </div>
        {group("Overdue", over, "text-rose-600 dark:text-rose-400")}
        {group("Today", todayL)}
        {group("This week", week)}
        {!over.length && !todayL.length && !week.length && <p className="px-5 py-5 text-sm text-slate-400">Nothing due this week.</p>}
      </section>

      <section className="flex flex-col gap-3" aria-label="Clients by phase">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Clients by phase</h2>
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
            {(["all", "mine"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBoard(b)}
                className={`text-xs font-medium px-3 py-1 rounded-md ${board === b ? "bg-white dark:bg-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                {b === "all" ? "All clients" : who === meId ? "Mine" : `${first}'s`}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-cols-[repeat(5,minmax(230px,1fr))] gap-3">
            {PHASES.map((ph) => {
              const list = shown.filter((c) => currentPhase(tasksByClient[c.id] ?? []) === ph.id);
              return (
                <div key={ph.id} className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-2.5 flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-2 px-1 pb-1 text-sm font-semibold">
                    <PhaseDot phase={ph.id} />
                    {ph.label}
                    <span className="ml-auto text-xs font-medium text-slate-400 tabular-nums">{list.length}</span>
                  </div>
                  {list.map((c) => (
                    <ClientCard key={c.id} client={c} tasks={tasksByClient[c.id] ?? []} owner={owner} />
                  ))}
                  {!list.length && <p className="text-xs text-slate-400 px-1 py-2">No clients here</p>}
                </div>
              );
            })}
          </div>
        </div>
        {notStarted > 0 && (
          <p className="text-xs text-slate-500">
            {notStarted} client{notStarted === 1 ? "" : "s"} haven&apos;t started the flow yet.{" "}
            <Link href="/clients" className="underline">Pick their package on the Clients page</Link>.
          </p>
        )}
      </section>

      {openTask && (
        <TaskDrawer
          task={openTask.t}
          client={openTask.c}
          clientTasks={tasksByClient[openTask.c.id] ?? []}
          profiles={profiles}
          tiers={tiers}
          onClose={() => setOpen(null)}
          onOpenTask={setOpen}
        />
      )}
      {newOpen && (
        <NewClientModal templates={templates} profiles={profiles} defaultLeadId={profiles.find((p) => /gizelle/i.test(p.name))?.id ?? meId} onClose={() => { setNewOpen(false); router.refresh(); }} />
      )}
    </div>
  );
}

function ClientCard({ client, tasks, owner }: { client: Client; tasks: Task[]; owner: (id: string | null) => Profile | undefined }) {
  const [now] = useState(() => Date.now());
  const done = tasks.filter(isDone).length;
  const next = sortFlowTasks(tasks).find((t) => !isDone(t));
  const due = next ? dueInfo(next.due_date) : null;
  const callUpcoming = client.call_at && new Date(client.call_at) > new Date();
  return (
    <Link
      href={`/clients/${client.id}`}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex flex-col gap-2 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{client.name}</p>
          <p className="text-xs text-slate-400 truncate">{client.business_name || (client.source === "calendar" ? "Booked from calendar" : "")}</p>
        </div>
        <span
          className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${
            client.package === "lead" ? "bg-amber-50 text-amber-700 border-transparent dark:bg-amber-500/15 dark:text-amber-300" : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
          }`}
        >
          {packageLabel(client.package, true)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ProgressBar done={done} total={tasks.length} className="flex-1" />
        <span className="text-[11px] text-slate-400 tabular-nums">{done}/{tasks.length}</span>
      </div>
      {next ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 min-w-0">
          <Avatar name={owner(next.assignee_id)?.name ?? "?"} url={owner(next.assignee_id)?.avatar_url} size="xs" />
          <span className="truncate">{next.title}</span>
        </div>
      ) : (
        <p className="text-xs text-emerald-600">All tasks done</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {due && <span className={`text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 ${due.tone}`}>{due.label === "Today" ? "Due today" : due.label}</span>}
        {client.clock_started_on && (
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 tabular-nums">
            Day {Math.min(14, Math.round((now - new Date(client.clock_started_on).getTime()) / 864e5) + 1)}/14
          </span>
        )}
        {callUpcoming && (
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
            Call {new Date(client.call_at!).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </Link>
  );
}

function CalendarBar({ sync, upcoming }: { sync: Record<string, unknown> | null; upcoming: number }) {
  const at = typeof sync?.at === "string" ? new Date(sync.at) : null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5">
      <CalendarDays className="w-4 h-4 text-purple-600 shrink-0" />
      {at ? (
        <>
          <span className="font-semibold">Calendar connected</span>
          <span className="text-slate-500">
            · info@clubsheis.com · {upcoming} upcoming discovery call{upcoming === 1 ? "" : "s"}
          </span>
          <span className="ml-auto text-xs text-slate-400">
            Synced {at.toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        </>
      ) : (
        <>
          <span className="text-slate-600 dark:text-slate-300">Discovery calls aren&apos;t syncing from the calendar yet.</span>
          <Link href="/settings/calendar" className="ml-auto text-xs font-semibold underline">Set it up</Link>
        </>
      )}
    </div>
  );
}
