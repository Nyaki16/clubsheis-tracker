"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutGrid, List, Plus, Search, X } from "lucide-react";
import { PHASES, currentPhase, isDone, isOperational, packageLabel, sortFlowTasks, type FlowTemplate, type PackageId } from "@/lib/flow";
import type { Client, Profile, Task } from "@/lib/types";
import { bulkUpdateClients, revivePastLead, startFlow, type BulkClientChange } from "@/app/actions/flow";
import { PhaseDot, ProgressBar, dueInfo, useToast } from "@/components/flow/ui";
import { NewClientModal } from "@/components/flow/client-modals";
import { MigrationNotice } from "@/components/flow/migration-notice";
import { usePackages } from "@/components/flow/packages-context";

export type ClientsView = "grid" | "list";
export type ClientsGroup = "phase" | "package" | "none";

type Group = { key: string; label: string; dot?: string; clients: Client[] };

const pkgBadge = (pkg: string | null) =>
  pkg === "lead"
    ? "bg-amber-50 text-amber-700 border-transparent dark:bg-amber-500/15 dark:text-amber-300"
    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300";

export default function FlowClientsList({
  clients,
  profiles,
  templates,
  tasksByClient,
  meId,
  migrated,
  clientsWithJobs = [],
  initialView = "grid",
  initialGroup = "phase",
}: {
  clients: Client[];
  profiles: Profile[];
  templates: FlowTemplate[];
  tasksByClient: Record<string, Task[]>;
  meId: string | null;
  migrated: boolean;
  clientsWithJobs?: string[];
  initialView?: ClientsView;
  initialGroup?: ClientsGroup;
}) {
  const router = useRouter();
  const toast = useToast();
  const PACKAGES = usePackages();
  const [, start] = useTransition();
  const [tab, setTab] = useState<"active" | "past">("active");
  const [q, setQ] = useState("");
  const [pkg, setPkg] = useState("");
  const [view, setView] = useState<ClientsView>(initialView);
  const [group, setGroup] = useState<ClientsGroup>(initialGroup);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);

  // Remember the layout in the address bar, so a refresh or a shared link keeps it.
  function setLayout(v: ClientsView, g: ClientsGroup) {
    setView(v);
    setGroup(g);
    const url = new URL(window.location.href);
    url.searchParams.set("view", v);
    url.searchParams.set("group", g);
    window.history.replaceState(null, "", url);
  }

  const active = clients.filter((c) => !c.is_past_lead);
  const past = clients.filter((c) => c.is_past_lead);
  const needle = q.trim().toLowerCase();
  const match = (c: Client) =>
    !needle || [c.name, c.business_name, c.email, c.call_message, c.call_title].some((v) => v?.toLowerCase().includes(needle));

  const list = useMemo(
    () => (tab === "active" ? active : past).filter((c) => match(c) && (!pkg || c.package === pkg || (pkg === "none" && !c.package))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, clients, needle, pkg]
  );

  const withJobs = useMemo(() => new Set(clientsWithJobs), [clientsWithJobs]);
  const operational = (c: Client) => isOperational(c, tasksByClient[c.id] ?? [], withJobs.has(c.id));

  const groups: Group[] = useMemo(() => {
    if (group === "none") return [{ key: "all", label: "", clients: list }];
    const out: Group[] =
      group === "phase"
        ? [
            ...PHASES.map((p) => ({ key: p.id as string, label: p.label as string, dot: p.dot as string, clients: [] as Client[] })),
            { key: "operational", label: "Operational", dot: "bg-violet-500", clients: [] },
            { key: "none", label: "Flow not started", dot: "bg-slate-300", clients: [] },
          ]
        : [
            ...PACKAGES.map((p) => ({ key: p.id as string, label: p.label as string, clients: [] as Client[] })),
            { key: "none", label: "Flow not started", clients: [] },
          ];
    for (const c of list) {
      const key =
        group === "phase" ? (isOperational(c, tasksByClient[c.id] ?? [], withJobs.has(c.id)) ? "operational" : currentPhase(tasksByClient[c.id] ?? []) ?? "none") : c.package ?? "none";
      (out.find((g) => g.key === key) ?? out[out.length - 1]).clients.push(c);
    }
    return out.filter((g) => g.clients.length);
  }, [group, list, tasksByClient, PACKAGES, withJobs]);

  // ── Selection + bulk edit ──
  const toggle = (ids: string[], on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      for (const id of ids) {
        if (on) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  const allIn = (ids: string[]) => ids.length > 0 && ids.every((id) => sel.has(id));
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);

  async function bulk(change: BulkClientChange, doneMsg: (r: { added: number; removed: number }) => string) {
    const ids = [...sel];
    const size = change.kind === "lead" || change.kind === "operational" || (change.kind === "past" && change.past) ? 25 : 4;
    const total = { added: 0, removed: 0 };
    setBusy({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i += size) {
        const r = await bulkUpdateClients(ids.slice(i, i + size), change);
        total.added += r.added;
        total.removed += r.removed;
        setBusy({ done: Math.min(i + size, ids.length), total: ids.length });
      }
      toast(doneMsg(total));
      setSel(new Set());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong. Some clients may not have changed.");
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  const n = sel.size;
  const plural = (k: number) => `${k} client${k === 1 ? "" : "s"}`;

  return (
    <div className={`flex flex-col gap-5 ${n ? "pb-24" : ""}`}>
      {!migrated && <MigrationNotice />}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {active.length} active · {past.length} past leads
          </p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          disabled={!migrated}
          className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> New client
        </button>
      </header>

      <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {(["active", "past"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              setSel(new Set());
            }}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? "border-purple-600 text-slate-900 dark:text-white" : "border-transparent text-slate-500"}`}
          >
            {t === "active" ? "Active" : "Past leads"}{" "}
            <span className="text-xs text-slate-400 tabular-nums">{t === "active" ? active.length : past.length}</span>
          </button>
        ))}
      </div>

      {tab === "past" && (
        <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-4 py-2.5">
          Discovery calls from before 1 September that never became clients. They stay searchable here, and if someone comes back, Move to Sales brings their call history with them.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "past" ? "Search by name, email or what they said" : "Search clients, brands or emails"}
            aria-label="Search"
            className="w-72 max-w-full text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md pl-8 pr-2.5 py-1.5"
          />
        </div>
        {tab === "active" && (
          <>
            <select value={pkg} onChange={(e) => setPkg(e.target.value)} aria-label="Filter by package" className="text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5">
              <option value="">All packages</option>
              {PACKAGES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
              <option value="none">Flow not started</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-slate-500">
              Group by
              <select
                value={group}
                onChange={(e) => setLayout(view, e.target.value as ClientsGroup)}
                className="text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-md px-2.5 py-1.5"
              >
                <option value="phase">Phase</option>
                <option value="package">Package</option>
                <option value="none">Nothing</option>
              </select>
            </label>
            <div role="group" aria-label="Layout" className="ml-auto flex rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden">
              {([
                ["grid", LayoutGrid, "Grid"],
                ["list", List, "List"],
              ] as const).map(([v, Icon, label]) => (
                <button
                  key={v}
                  onClick={() => setLayout(v, group)}
                  aria-pressed={view === v}
                  className={`flex items-center gap-1.5 text-sm px-2.5 py-1.5 ${view === v ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {tab === "past" ? (
        <PastLeadsTable
          list={[...list].sort((a, b) => (b.call_at ?? "").localeCompare(a.call_at ?? ""))}
          sel={sel}
          toggle={toggle}
          onRevive={(c) =>
            start(async () => {
              await revivePastLead(c.id);
              toast(`${c.name} moved to Sales with their call attached`);
              router.push(`/clients/${c.id}`);
            })
          }
        />
      ) : !list.length ? (
        <p className="text-sm text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-6">No clients match.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => {
            const ids = g.clients.map((c) => c.id);
            const isCollapsed = collapsed.has(g.key);
            return (
              <section key={g.key} className="flex flex-col gap-2.5">
                {group !== "none" && (
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Select every client in ${g.label}`}
                      checked={allIn(ids)}
                      onChange={(e) => toggle(ids, e.target.checked)}
                      className="w-4 h-4 accent-purple-600"
                    />
                    <button
                      onClick={() =>
                        setCollapsed((s) => {
                          const n = new Set(s);
                          if (n.has(g.key)) n.delete(g.key);
                          else n.add(g.key);
                          return n;
                        })
                      }
                      aria-expanded={!isCollapsed}
                      className="flex items-center gap-2 text-sm font-semibold"
                    >
                      {g.dot && <span className={`w-2.5 h-2.5 rounded-full ${g.dot}`} />}
                      {g.label}
                      <span className="text-xs text-slate-400 font-normal tabular-nums">{g.clients.length}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition ${isCollapsed ? "-rotate-90" : ""}`} />
                    </button>
                  </div>
                )}
                {!isCollapsed &&
                  (view === "grid" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                      {g.clients.map((c) => (
                        <ClientCard
                          key={c.id}
                          c={c}
                          ts={tasksByClient[c.id] ?? []}
                          operational={operational(c)}
                          selected={sel.has(c.id)}
                          onSelect={(on) => toggle([c.id], on)}
                          onOpen={() => router.push(`/clients/${c.id}`)}
                          startSlot={<StartFlow c={c} migrated={migrated} />}
                        />
                      ))}
                    </div>
                  ) : (
                    <ClientTable
                      list={g.clients}
                      tasksByClient={tasksByClient}
                      operational={operational}
                      sel={sel}
                      toggle={toggle}
                      allIn={allIn}
                      onOpen={(c) => router.push(`/clients/${c.id}`)}
                      migrated={migrated}
                    />
                  ))}
              </section>
            );
          })}
        </div>
      )}

      {n > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 lg:ml-30 z-30 w-[calc(100%-2rem)] max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl px-4 py-3 text-sm">
            {busy ? (
              <span className="font-medium">Updating {busy.done} of {busy.total}…</span>
            ) : (
              <>
                <span className="font-semibold mr-1">{n} selected</span>
                {tab === "active" ? (
                  <>
                    <select
                      value=""
                      aria-label="Change package for the selected clients"
                      onChange={(e) => {
                        const p = e.target.value as PackageId;
                        if (!p) return;
                        if (
                          !window.confirm(
                            `Move ${plural(n)} to ${packageLabel(p)}?\n\nTheir task lists change to match: new tasks are added, and untouched tasks that package doesn't have are removed. Tasks with work in them always stay.`
                          )
                        )
                          return;
                        bulk({ kind: "package", pkg: p }, (r) => `${plural(n)} on ${packageLabel(p)} · ${r.added} tasks added, ${r.removed} removed`);
                      }}
                      className="bulk-select"
                    >
                      <option value="">Set package…</option>
                      {PACKAGES.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    <LeadSelect profiles={profiles} onPick={(id, name) => bulk({ kind: "lead", leadId: id }, () => `${name} now leads ${plural(n)}`)} />
                    <select
                      value=""
                      aria-label="Operational for the selected clients"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        const value = v === "in" ? true : v === "out" ? false : null;
                        bulk({ kind: "operational", value }, () =>
                          value === true ? `${plural(n)} moved to Operational` : value === false ? `${plural(n)} kept out of Operational` : `${plural(n)} back to automatic`
                        );
                      }}
                      className="bulk-select"
                    >
                      <option value="">Operational…</option>
                      <option value="in">Move to Operational</option>
                      <option value="out">Take out of Operational</option>
                      <option value="auto">Automatic</option>
                    </select>
                    <button onClick={() => bulk({ kind: "past", past: true }, () => `${plural(n)} moved to Past leads`)} className="bulk-btn">
                      Move to Past leads
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => bulk({ kind: "past", past: false }, () => `${plural(n)} moved to Sales`)} className="bulk-btn">
                      Move to Sales
                    </button>
                    <LeadSelect profiles={profiles} onPick={(id, name) => bulk({ kind: "lead", leadId: id }, () => `${name} now leads ${plural(n)}`)} />
                  </>
                )}
                <button onClick={() => setSel(new Set())} className="ml-auto p-1 rounded hover:bg-white/10 dark:hover:bg-slate-900/10" aria-label="Clear selection" title="Clear selection">
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <style>{`
            .bulk-select, .bulk-btn { font-size: 13px; border-radius: 6px; padding: 4px 10px; border: 1px solid rgb(255 255 255 / .25); background: transparent; color: inherit; }
            .bulk-select option { color: #0f172a; }
            .bulk-btn:hover, .bulk-select:hover { background: rgb(255 255 255 / .1); }
            :is(.dark) .bulk-select, :is(.dark) .bulk-btn { border-color: rgb(15 23 42 / .2); }
          `}</style>
        </div>
      )}

      {newOpen && (
        <NewClientModal
          templates={templates}
          profiles={profiles}
          defaultLeadId={profiles.find((p) => /gizelle/i.test(p.name))?.id ?? meId}
          onClose={() => { setNewOpen(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function LeadSelect({ profiles, onPick }: { profiles: Profile[]; onPick: (id: string | null, name: string) => void }) {
  return (
    <select
      value=""
      aria-label="Change lead for the selected clients"
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        if (v === "none") onPick(null, "Nobody");
        else onPick(v, profiles.find((p) => p.id === v)?.name ?? "They");
      }}
      className="bulk-select"
    >
      <option value="">Set lead…</option>
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
      <option value="none">No lead</option>
    </select>
  );
}

function StartFlow({ c, migrated }: { c: Client; migrated: boolean }) {
  const toast = useToast();
  const PACKAGES = usePackages();
  const [, start] = useTransition();
  return (
    <select
      aria-label={`Start the flow for ${c.name}`}
      defaultValue=""
      disabled={!migrated}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const p = e.target.value as PackageId;
        if (!p) return;
        start(async () => {
          const r = await startFlow(c.id, p);
          toast(`${c.name}: ${r.issued} tasks issued from ${packageLabel(p)}`);
        });
      }}
      className="text-xs border border-dashed border-slate-300 dark:border-slate-600 bg-transparent rounded-md px-2 py-1"
    >
      <option value="">Start flow…</option>
      {PACKAGES.map((p) => (
        <option key={p.id} value={p.id}>{p.label}</option>
      ))}
    </select>
  );
}

function flowInfo(ts: Task[]) {
  const done = ts.filter(isDone).length;
  const next = sortFlowTasks(ts).find((t) => !isDone(t));
  return { done, next, ph: currentPhase(ts), due: next ? dueInfo(next.due_date) : null, pct: ts.length ? Math.round((done / ts.length) * 100) : 0 };
}

function ClientCard({
  c,
  ts,
  operational,
  selected,
  onSelect,
  onOpen,
  startSlot,
}: {
  c: Client;
  ts: Task[];
  operational: boolean;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onOpen: () => void;
  startSlot: React.ReactNode;
}) {
  const { done, next, ph, due, pct } = flowInfo(ts);
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onOpen()}
      className={`group relative flex flex-col gap-3 rounded-xl border bg-white dark:bg-slate-900 p-4 cursor-pointer transition hover:shadow-md ${
        selected ? "border-purple-500 ring-2 ring-purple-500/30" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          aria-label={`Select ${c.name}`}
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSelect(e.target.checked)}
          className={`mt-1 w-4 h-4 accent-purple-600 shrink-0 ${selected ? "" : "sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"}`}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{c.name}</p>
          <p className="text-xs text-slate-400 truncate">{c.business_name || c.email || " "}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {ts.length ? (
          <>
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${pkgBadge(c.package)}`}>{packageLabel(c.package, true)}</span>
            {operational ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="inline-block w-2 h-2 rounded-full bg-violet-500" />
                Operational
              </span>
            ) : (
              ph && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <PhaseDot phase={ph} />
                  {PHASES.find((p) => p.id === ph)?.label}
                </span>
              )
            )}
          </>
        ) : (
          startSlot
        )}
      </div>
      {ts.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <ProgressBar done={done} total={ts.length} className="flex-1" />
            <span className="text-xs text-slate-400 tabular-nums">{pct}%</span>
          </div>
          <div className="text-sm min-h-[2.5rem]">
            {next ? (
              <>
                <p className="truncate">{next.title}</p>
                <p className={`text-xs ${due?.tone}`}>{due?.label}</p>
              </>
            ) : (
              <p className="text-xs text-emerald-600">All done</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ClientTable({
  list,
  tasksByClient,
  operational,
  sel,
  toggle,
  allIn,
  onOpen,
  migrated,
}: {
  list: Client[];
  tasksByClient: Record<string, Task[]>;
  operational: (c: Client) => boolean;
  sel: Set<string>;
  toggle: (ids: string[], on: boolean) => void;
  allIn: (ids: string[]) => boolean;
  onOpen: (c: Client) => void;
  migrated: boolean;
}) {
  const ids = list.map((c) => c.id);
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <th className="pl-4 py-2.5 w-8">
              <input type="checkbox" aria-label="Select all" checked={allIn(ids)} onChange={(e) => toggle(ids, e.target.checked)} className="w-4 h-4 accent-purple-600 align-middle" />
            </th>
            <th className="px-4 py-2.5 font-semibold">Client</th>
            <th className="px-4 py-2.5 font-semibold">Package</th>
            <th className="px-4 py-2.5 font-semibold">Phase</th>
            <th className="px-4 py-2.5 font-semibold">Progress</th>
            <th className="px-4 py-2.5 font-semibold">Next task</th>
          </tr>
        </thead>
        <tbody>
          {list.map((c) => {
            const ts = tasksByClient[c.id] ?? [];
            const { done, next, ph, due, pct } = flowInfo(ts);
            const selected = sel.has(c.id);
            return (
              <tr
                key={c.id}
                onClick={() => onOpen(c)}
                className={`border-b last:border-0 border-slate-100 dark:border-slate-800 cursor-pointer ${selected ? "bg-purple-50/60 dark:bg-purple-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
              >
                <td className="pl-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${c.name}`} checked={selected} onChange={(e) => toggle([c.id], e.target.checked)} className="w-4 h-4 accent-purple-600 align-middle" />
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.business_name || c.email || ""}</p>
                </td>
                <td className="px-4 py-3">
                  {ts.length ? (
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${pkgBadge(c.package)}`}>{packageLabel(c.package, true)}</span>
                  ) : (
                    <StartFlow c={c} migrated={migrated} />
                  )}
                </td>
                <td className="px-4 py-3">
                  {operational(c) ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-violet-500" />
                      Operational
                    </span>
                  ) : ph ? (
                    <span className="inline-flex items-center gap-1.5">
                      <PhaseDot phase={ph} />
                      {PHASES.find((p) => p.id === ph)?.label}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 min-w-[150px]">
                  {ts.length ? (
                    <div className="flex items-center gap-2">
                      <ProgressBar done={done} total={ts.length} className="flex-1" />
                      <span className="text-xs text-slate-400 tabular-nums">{pct}%</span>
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {next ? (
                    <>
                      <p>{next.title}</p>
                      <p className={`text-xs ${due?.tone}`}>{due?.label}</p>
                    </>
                  ) : ts.length ? (
                    <p className="text-xs text-emerald-600">All done</p>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function PastLeadsTable({
  list,
  sel,
  toggle,
  onRevive,
}: {
  list: Client[];
  sel: Set<string>;
  toggle: (ids: string[], on: boolean) => void;
  onRevive: (c: Client) => void;
}) {
  const ids = list.map((c) => c.id);
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <th className="pl-4 py-2.5 w-8">
              <input
                type="checkbox"
                aria-label="Select all past leads"
                checked={ids.length > 0 && ids.every((id) => sel.has(id))}
                onChange={(e) => toggle(ids, e.target.checked)}
                className="w-4 h-4 accent-purple-600 align-middle"
              />
            </th>
            <th className="px-4 py-2.5 font-semibold">Lead</th>
            <th className="px-4 py-2.5 font-semibold">Discovery call</th>
            <th className="px-4 py-2.5 font-semibold">What they said when booking</th>
            <th className="px-4 py-2.5 font-semibold">Notes</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id} className={`border-b last:border-0 border-slate-100 dark:border-slate-800 align-top ${sel.has(c.id) ? "bg-purple-50/60 dark:bg-purple-500/10" : ""}`}>
              <td className="pl-4 py-3">
                <input type="checkbox" aria-label={`Select ${c.name}`} checked={sel.has(c.id)} onChange={(e) => toggle([c.id], e.target.checked)} className="w-4 h-4 accent-purple-600 align-middle" />
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-slate-400">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {c.call_at ? new Date(c.call_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                <p className="text-xs text-slate-400 max-w-[220px] truncate">{c.call_title}</p>
              </td>
              <td className="px-4 py-3 max-w-[300px] text-xs text-slate-600 dark:text-slate-300">{c.call_message || "—"}</td>
              <td className="px-4 py-3">
                {c.call_notes_url ? (
                  <a href={c.call_notes_url} target="_blank" rel="noopener noreferrer" className="text-xs underline whitespace-nowrap">Notes by Gemini</a>
                ) : (
                  <span className="text-xs text-slate-400">None</span>
                )}
              </td>
              <td className="px-4 py-3">
                <button onClick={() => onRevive(c)} className="text-xs font-medium border border-slate-300 dark:border-slate-600 px-2.5 py-1 rounded-md whitespace-nowrap hover:bg-slate-50 dark:hover:bg-slate-800">
                  Move to Sales
                </button>
              </td>
            </tr>
          ))}
          {!list.length && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-sm text-slate-400">No past leads yet. They arrive here when the calendar sync runs its backfill.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
