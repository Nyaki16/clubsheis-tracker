"use client";

import { useState, useTransition } from "react";
import { TASK_STATUSES, type TaskStatusId } from "@/lib/constants";
import type { Profile, Client, Job, Task } from "@/lib/types";

export function ClientForm({ onSubmit }: { onSubmit: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      await onSubmit(name.trim());
    });
  }

  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">Client name</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Palesa Dooms"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-slate-900"
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <button
        onClick={submit}
        disabled={pending}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add client"}
      </button>
    </div>
  );
}

export function JobForm({
  onSubmit,
  clients,
}: {
  onSubmit: (name: string, dueDate: string, clientId?: string) => Promise<void>;
  clients?: Client[];
}) {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clientId, setClientId] = useState("");
  const [pending, startTransition] = useTransition();

  const needsClientPicker = !!clients;

  function submit() {
    if (!name.trim()) return;
    if (needsClientPicker && !clientId) return;
    startTransition(async () => {
      await onSubmit(name.trim(), dueDate, needsClientPicker ? clientId : undefined);
    });
  }

  return (
    <div>
      {needsClientPicker && (
        <>
          <label className="text-sm font-medium block mb-1.5">Client</label>
          <select
            autoFocus
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-slate-900"
          >
            <option value="">Select a client…</option>
            {clients!.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </>
      )}
      <label className="text-sm font-medium block mb-1.5">Job name</label>
      <input
        autoFocus={!needsClientPicker}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. November Studio Day"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-slate-900"
      />
      <label className="text-sm font-medium block mb-1.5">Due date (optional)</label>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-slate-900"
      />
      <button
        onClick={submit}
        disabled={pending}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create job"}
      </button>
    </div>
  );
}

export type TaskFormPayload = {
  title: string;
  assignee_id: string | null;
  due_date: string;
  notes: string;
  status: TaskStatusId;
  job_id?: string;
};

export type TaskFormSubmit = (input: TaskFormPayload) => Promise<void>;

export function TaskForm({
  onSubmit,
  initial,
  submitLabel,
  profiles,
  clients,
  jobs,
  needsJobPicker,
}: {
  onSubmit: TaskFormSubmit;
  initial?: Task | null;
  submitLabel?: string;
  profiles: Profile[];
  clients?: Client[];
  jobs?: Job[];
  needsJobPicker?: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [assigneeId, setAssigneeId] = useState<string>(initial?.assignee_id ?? "");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<TaskStatusId>((initial?.status as TaskStatusId) ?? "planning");
  const [clientId, setClientId] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const filteredJobs = (jobs ?? []).filter((j) => j.client_id === clientId);

  function submit() {
    if (!title.trim()) return;
    if (needsJobPicker && !jobId) return;
    startTransition(async () => {
      await onSubmit({
        title: title.trim(),
        assignee_id: assigneeId || null,
        due_date: dueDate,
        notes,
        status,
        job_id: needsJobPicker ? jobId : undefined,
      });
    });
  }

  return (
    <div>
      {needsJobPicker && (
        <>
          <label className="text-sm font-medium block mb-1.5">Client</label>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setJobId("");
            }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-slate-900"
          >
            <option value="">Select a client…</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {clientId && (
            <>
              <label className="text-sm font-medium block mb-1.5">Job</label>
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-slate-900"
              >
                <option value="">Select a job…</option>
                {filteredJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </>
      )}

      <label className="text-sm font-medium block mb-1.5">Task</label>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Write script for Reel 1"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-slate-900"
      />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">Assign to</label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
          >
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatusId)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="text-sm font-medium block mb-1.5">Due date (optional)</label>
      <input
        type="date"
        value={dueDate ?? ""}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-slate-900"
      />

      <label className="text-sm font-medium block mb-1.5">Notes (optional)</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Context, links, blockers…"
        rows={3}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-slate-900 resize-none"
      />

      <button
        onClick={submit}
        disabled={pending}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel ?? "Add task"}
      </button>
    </div>
  );
}

export function DeliverableForm({
  onSubmit,
}: {
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      await onSubmit(name.trim());
    });
  }

  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">Deliverable name</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. 4 IG Reels — Batch 1"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-slate-900"
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <button
        onClick={submit}
        disabled={pending}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add deliverable"}
      </button>
    </div>
  );
}
