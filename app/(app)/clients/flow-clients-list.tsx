"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { PACKAGES, PHASES, currentPhase, isDone, packageLabel, sortFlowTasks, type FlowTemplate, type PackageId } from "@/lib/flow";
import type { Client, Profile, Task } from "@/lib/types";
import { revivePastLead, startFlow } from "@/app/actions/flow";
import Avatar from "@/components/avatar";
import { PhaseDot, ProgressBar, dueInfo, useToast } from "@/components/flow/ui";
import { NewClientModal } from "@/components/flow/client-modals";
import { MigrationNotice } from "@/components/flow/migration-notice";

export default function FlowClientsList({
  clients,
  profiles,
  templates,
  tasksByClient,
  meId,
  migrated,
}: {
  clients: Client[];
  profiles: Profile[];
  templates: FlowTemplate[];
  tasksByClient: Record<string, Task[]>;
  meId: string | null;
  migrated: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [tab, setTab] = useState<"active" | "past">("active");
  const [q, setQ] = useState("");
  const [pkg, setPkg] = useState("");
  const [newOpen, setNewOpen] = useState(false);

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
  const owner = (id: string | null) => profiles.find((p) => p.id === id);

  return (
    <div className="flex flex-col gap-5">
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
            onClick={() => setTab(t)}
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

      <div className="flex flex-wrap gap-2">
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
          <select value={pkg} onChange={(e) => setPkg(e.target.value)} aria-label="Filter by package" className="text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5">
            <option value="">All packages</option>
            {PACKAGES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option value="none">Flow not started</option>
          </select>
        )}
      </div>

      {tab === "past" ? (
        <PastLeadsTable
          list={[...list].sort((a, b) => (b.call_at ?? "").localeCompare(a.call_at ?? ""))}
          onRevive={(c) =>
            start(async () => {
              await revivePastLead(c.id);
              toast(`${c.name} moved to Sales with their call attached`);
              router.push(`/clients/${c.id}`);
            })
          }
        />
      ) : (
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold">Package</th>
              <th className="px-4 py-2.5 font-semibold">Phase</th>
              <th className="px-4 py-2.5 font-semibold">Progress</th>
              <th className="px-4 py-2.5 font-semibold">Next task</th>
              <th className="px-4 py-2.5 font-semibold">Lead</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const ts = tasksByClient[c.id] ?? [];
              const done = ts.filter(isDone).length;
              const next = sortFlowTasks(ts).find((t) => !isDone(t));
              const ph = currentPhase(ts);
              const due = next ? dueInfo(next.due_date) : null;
              const lead = owner(c.lead_id);
              return (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/clients/${c.id}`)}
                  className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.business_name || c.email || ""}</p>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => !ts.length && e.stopPropagation()}>
                    {ts.length ? (
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${c.package === "lead" ? "bg-amber-50 text-amber-700 border-transparent dark:bg-amber-500/15 dark:text-amber-300" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                        {packageLabel(c.package, true)}
                      </span>
                    ) : (
                      <select
                        aria-label={`Start the flow for ${c.name}`}
                        defaultValue=""
                        disabled={!migrated}
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
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {ph ? (
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
                        <span className="text-xs text-slate-400 tabular-nums">{Math.round((done / ts.length) * 100)}%</span>
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
                  <td className="px-4 py-3">{lead && <Avatar name={lead.name} url={lead.avatar_url} size="md" />}</td>
                </tr>
              );
            })}
            {!list.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-slate-400">
                  No clients match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
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

function PastLeadsTable({ list, onRevive }: { list: Client[]; onRevive: (c: Client) => void }) {
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <th className="px-4 py-2.5 font-semibold">Lead</th>
            <th className="px-4 py-2.5 font-semibold">Discovery call</th>
            <th className="px-4 py-2.5 font-semibold">What they said when booking</th>
            <th className="px-4 py-2.5 font-semibold">Notes</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id} className="border-b last:border-0 border-slate-100 dark:border-slate-800 align-top">
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
              <td colSpan={5} className="px-4 py-6 text-sm text-slate-400">No past leads yet. They arrive here when the calendar sync runs its backfill.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
