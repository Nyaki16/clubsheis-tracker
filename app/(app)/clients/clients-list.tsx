"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/modal";
import { ClientForm, ClientProfileForm } from "@/components/forms";
import type { Client, Job } from "@/lib/types";
import { createClientRow, deleteClient, updateClient } from "@/app/actions/clients";

export default function ClientsList({
  clients,
  jobs,
}: {
  clients: Client[];
  jobs: Job[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [, startTransition] = useTransition();

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {clients.length === 0 && (
          <div className="md:col-span-3 bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <p className="text-slate-500 text-sm">No clients yet. Add one to get started.</p>
          </div>
        )}
        {clients.map((client) => {
          const clientJobs = jobs.filter((j) => j.client_id === client.id);
          const activeJobs = clientJobs.filter((j) => j.stage !== "delivered").length;
          return (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-400 hover:shadow-sm transition group"
            >
              <div className="flex items-start justify-between mb-3">
                {client.profile_pic_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={client.profile_pic_url}
                    alt={client.name}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: client.color }}
                  >
                    {client.name[0]?.toUpperCase()}
                  </div>
                )}
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
                {activeJobs} active {activeJobs === 1 ? "job" : "jobs"} · {clientJobs.length} total
              </p>
            </Link>
          );
        })}
      </div>

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
