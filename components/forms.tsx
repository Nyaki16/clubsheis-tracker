"use client";

import { useState, useTransition } from "react";
import { TASK_STATUSES, type TaskStatusId } from "@/lib/constants";
import { JOB_TEMPLATES } from "@/lib/job-templates";
import type { Profile, Client, ClientProfileInput, Job, Task } from "@/lib/types";

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
  onSubmit: (
    name: string,
    dueDate: string,
    clientId?: string,
    templateId?: string | null
  ) => Promise<void>;
  clients?: Client[];
}) {
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clientId, setClientId] = useState("");
  const [pending, startTransition] = useTransition();

  const needsClientPicker = !!clients;
  const selectedTemplate = JOB_TEMPLATES.find((t) => t.id === templateId) ?? null;

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = JOB_TEMPLATES.find((x) => x.id === id);
    if (t && !name.trim()) setName(t.defaultJobName);
  }

  function submit() {
    if (!name.trim()) return;
    if (needsClientPicker && !clientId) return;
    startTransition(async () => {
      await onSubmit(
        name.trim(),
        dueDate,
        needsClientPicker ? clientId : undefined,
        templateId || null
      );
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

      <label className="text-sm font-medium block mb-1.5">Template (optional)</label>
      <select
        value={templateId}
        onChange={(e) => pickTemplate(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:border-slate-900"
      >
        <option value="">No template (blank job)</option>
        {JOB_TEMPLATES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      {selectedTemplate ? (
        <p className="text-xs text-slate-500 mb-3">
          Will create {selectedTemplate.tasks.length} starter tasks · {selectedTemplate.description}
        </p>
      ) : (
        <div className="mb-3" />
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

const PROFILE_FIELDS: {
  key: keyof Omit<ClientProfileInput, "name" | "business_name" | "about" | "profile_pic_url">;
  label: string;
  placeholder: string;
}[] = [
  { key: "website_url", label: "Website", placeholder: "https://example.com" },
  { key: "instagram_url", label: "Instagram", placeholder: "https://instagram.com/handle" },
  { key: "tiktok_url", label: "TikTok", placeholder: "https://tiktok.com/@handle" },
  { key: "facebook_url", label: "Facebook", placeholder: "https://facebook.com/page" },
  { key: "linkedin_url", label: "LinkedIn", placeholder: "https://linkedin.com/in/handle" },
  { key: "youtube_url", label: "YouTube", placeholder: "https://youtube.com/@channel" },
  { key: "google_drive_url", label: "Google Drive folder", placeholder: "https://drive.google.com/…" },
  { key: "canva_brand_url", label: "Canva brand kit", placeholder: "https://canva.com/brand/…" },
];

export function ClientProfileForm({
  client,
  onSubmit,
}: {
  client: Client;
  onSubmit: (input: ClientProfileInput) => Promise<void>;
}) {
  const [form, setForm] = useState<ClientProfileInput>({
    name: client.name,
    business_name: client.business_name,
    about: client.about,
    profile_pic_url: client.profile_pic_url,
    instagram_url: client.instagram_url,
    tiktok_url: client.tiktok_url,
    facebook_url: client.facebook_url,
    linkedin_url: client.linkedin_url,
    youtube_url: client.youtube_url,
    website_url: client.website_url,
    google_drive_url: client.google_drive_url,
    canva_brand_url: client.canva_brand_url,
  });
  const [pending, startTransition] = useTransition();

  function set<K extends keyof ClientProfileInput>(key: K, value: ClientProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    if (!form.name.trim()) return;
    startTransition(async () => {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        business_name: form.business_name?.trim() || null,
        about: form.about?.trim() || null,
        profile_pic_url: form.profile_pic_url?.trim() || null,
      });
    });
  }

  const input =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900";

  return (
    <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">Client name</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Palesa Dooms"
            className={input}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Business name</label>
          <input
            value={form.business_name ?? ""}
            onChange={(e) => set("business_name", e.target.value)}
            placeholder="Dooms Studio"
            className={input}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1.5">Profile picture URL</label>
        <input
          value={form.profile_pic_url ?? ""}
          onChange={(e) => set("profile_pic_url", e.target.value)}
          placeholder="https://… (paste a public image link)"
          className={input}
        />
        {form.profile_pic_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={form.profile_pic_url}
            alt="Profile preview"
            className="mt-2 w-16 h-16 rounded-full object-cover border border-slate-200"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>

      <div>
        <label className="text-sm font-medium block mb-1.5">
          About / background / offerings
        </label>
        <textarea
          value={form.about ?? ""}
          onChange={(e) => set("about", e.target.value)}
          placeholder="Who they are, what their business does, what they sell…"
          rows={5}
          className={input + " resize-y min-h-[100px]"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PROFILE_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-sm font-medium block mb-1.5">{f.label}</label>
            <input
              value={(form[f.key] as string | null) ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={input}
            />
          </div>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={pending}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
