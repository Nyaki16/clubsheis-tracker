"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  LayoutGrid,
  List as ListIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Modal from "@/components/modal";
import { ClientForm, ClientProfileForm } from "@/components/forms";
import type { Client, Job } from "@/lib/types";
import { createClientRow, deleteClient, updateClient } from "@/app/actions/clients";

type SortBy =
  | "name-asc"
  | "name-desc"
  | "active-desc"
  | "total-desc"
  | "recent";

const SORT_LABELS: Record<SortBy, string> = {
  "name-asc": "Name (A → Z)",
  "name-desc": "Name (Z → A)",
  "active-desc": "Most active jobs",
  "total-desc": "Most total jobs",
  recent: "Recently added",
};

type Activity = "all" | "active" | "inactive";
const ACTIVITY_LABELS: Record<Activity, string> = {
  all: "All clients",
  active: "With active jobs",
  inactive: "No active jobs",
};

type ViewMode = "grid" | "list";

export default function ClientsList({
  clients,
  jobs,
}: {
  clients: Client[];
  jobs: Job[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name-asc");
  const [activity, setActivity] = useState<Activity>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [, startTransition] = useTransition();

  useEffect(() => {
    try {
      const s = localStorage.getItem("clients.sortBy");
      if (s && s in SORT_LABELS) setSortBy(s as SortBy);
      const a = localStorage.getItem("clients.activity");
      if (a === "all" || a === "active" || a === "inactive") setActivity(a);
      const v = localStorage.getItem("clients.view");
      if (v === "grid" || v === "list") setView(v);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("clients.sortBy", sortBy);
      localStorage.setItem("clients.activity", activity);
      localStorage.setItem("clients.view", view);
    } catch {}
  }, [sortBy, activity, view]);

  const visibleClients = useMemo(() => {
    const q = search.trim().toLowerCase();

    const countsByClient = new Map<string, { active: number; total: number }>();
    clients.forEach((c) => countsByClient.set(c.id, { active: 0, total: 0 }));
    jobs.forEach((j) => {
      const counts = countsByClient.get(j.client_id);
      if (!counts) return;
      counts.total += 1;
      if (j.stage !== "delivered") counts.active += 1;
    });

    let matches = q
      ? clients.filter((c) => {
          const hay = `${c.name} ${c.business_name ?? ""}`.toLowerCase();
          return hay.includes(q);
        })
      : clients.slice();

    if (activity !== "all") {
      matches = matches.filter((c) => {
        const counts = countsByClient.get(c.id) ?? { active: 0, total: 0 };
        return activity === "active" ? counts.active > 0 : counts.active === 0;
      });
    }

    matches.sort((a, b) => {
      const ca = countsByClient.get(a.id) ?? { active: 0, total: 0 };
      const cb = countsByClient.get(b.id) ?? { active: 0, total: 0 };
      switch (sortBy) {
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "active-desc":
          return cb.active - ca.active || a.name.localeCompare(b.name);
        case "total-desc":
          return cb.total - ca.total || a.name.localeCompare(b.name);
        case "recent":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "name-asc":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return matches;
  }, [clients, jobs, search, sortBy, activity]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Clients</h2>
          <p className="text-slate-500 text-sm">Click a client to see their jobs.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" /> Add client
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or business…"
            className="w-full border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-slate-900"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">Filter</label>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value as Activity)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-slate-900"
          >
            {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-slate-900"
          >
            {(Object.keys(SORT_LABELS) as SortBy[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            onClick={() => setView("grid")}
            className={`text-xs px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1.5 ${
              view === "grid"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Grid</span>
          </button>
          <button
            onClick={() => setView("list")}
            className={`text-xs px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1.5 ${
              view === "list"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
            aria-label="List view"
          >
            <ListIcon className="w-4 h-4" />
            <span>List</span>
          </button>
        </div>
        <div className="text-xs text-slate-500 sm:ml-auto whitespace-nowrap">
          <strong className="text-slate-900">{visibleClients.length}</strong>
          {visibleClients.length !== clients.length && ` of ${clients.length}`}
        </div>
      </div>

      {clients.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-500 text-sm">No clients yet. Add one to get started.</p>
        </div>
      )}
      {clients.length > 0 && visibleClients.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-slate-500 text-sm">No clients match these filters.</p>
        </div>
      )}

      {view === "grid" && visibleClients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {visibleClients.map((client) => {
            const clientJobs = jobs.filter((j) => j.client_id === client.id);
            const activeJobs = clientJobs.filter(
              (j) => j.stage !== "delivered"
            ).length;
            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-400 hover:shadow-sm transition group"
              >
                <div className="flex items-start justify-between mb-3">
                  <ClientAvatar client={client} />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditing(client);
                      }}
                      className="text-slate-400 hover:text-slate-900 p-1"
                      aria-label={`Edit ${client.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm(`Delete ${client.name} and all their jobs?`)) {
                          startTransition(() => deleteClient(client.id));
                        }
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      aria-label={`Delete ${client.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold mb-0.5">{client.name}</h3>
                {client.business_name && (
                  <p className="text-xs text-slate-500 mb-1">{client.business_name}</p>
                )}
                <p className="text-sm text-slate-500">
                  {activeJobs} active {activeJobs === 1 ? "job" : "jobs"} ·{" "}
                  {clientJobs.length} total
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {view === "list" && visibleClients.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2 text-xs uppercase tracking-wide text-slate-400 font-medium bg-slate-50/50">
            <div className="col-span-4">Client</div>
            <div className="col-span-4">Business</div>
            <div className="col-span-2">Active</div>
            <div className="col-span-2">Total jobs</div>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleClients.map((client) => {
              const clientJobs = jobs.filter((j) => j.client_id === client.id);
              const activeJobs = clientJobs.filter(
                (j) => j.stage !== "delivered"
              ).length;
              return (
                <div
                  key={client.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-3 hover:bg-slate-50 group items-center"
                >
                  <Link
                    href={`/clients/${client.id}`}
                    className="md:col-span-4 flex items-center gap-3 min-w-0"
                  >
                    <ClientAvatar client={client} />
                    <span className="font-semibold truncate">{client.name}</span>
                  </Link>
                  <div className="md:col-span-4 text-sm text-slate-600 truncate">
                    {client.business_name ?? (
                      <span className="text-slate-400 italic">—</span>
                    )}
                  </div>
                  <div className="md:col-span-2 text-sm text-slate-600">
                    {activeJobs}
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-600">{clientJobs.length}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => setEditing(client)}
                        className="text-slate-400 hover:text-slate-900 p-1"
                        aria-label={`Edit ${client.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(`Delete ${client.name} and all their jobs?`)
                          ) {
                            startTransition(() => deleteClient(client.id));
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        aria-label={`Delete ${client.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <ClientProfileForm
            client={editing}
            onSubmit={async (input) => {
              await updateClient(editing.id, input);
              setEditing(null);
            }}
          />
        </Modal>
      )}

      {showNew && (
        <Modal title="Add client" onClose={() => setShowNew(false)}>
          <ClientForm
            onSubmit={async (name) => {
              await createClientRow(name);
              setShowNew(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function ClientAvatar({ client }: { client: Client }) {
  const [failed, setFailed] = useState(false);
  if (client.profile_pic_url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={client.profile_pic_url}
        alt={client.name}
        className="w-10 h-10 rounded-lg object-cover border border-slate-200"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
      style={{ backgroundColor: client.color }}
    >
      {client.name[0]?.toUpperCase()}
    </div>
  );
}
