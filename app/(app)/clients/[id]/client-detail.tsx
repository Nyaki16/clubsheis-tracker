"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AtSign,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  Hash,
  Link as LinkIcon,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import Modal from "@/components/modal";
import { ClientDateForm, ClientProfileForm, TaskForm } from "@/components/forms";
import {
  createClientDate,
  deleteClientDate,
  updateClientDate,
} from "@/app/actions/client-dates";
import { TaskGridHeader, TaskGridRow } from "@/components/task-row";
import BulkActionBar from "@/components/bulk-action-bar";
import ProgressDonut from "@/components/progress-donut";
import NewJobButton from "./new-job-button";
import type {
  Client,
  ClientDate,
  ClientFlowDocs,
  Job,
  Profile,
  Task,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { updateClient } from "@/app/actions/clients";
import { createTask } from "@/app/actions/tasks";

const LINK_FIELDS: {
  key:
    | "website_url"
    | "instagram_url"
    | "tiktok_url"
    | "facebook_url"
    | "linkedin_url"
    | "youtube_url"
    | "google_drive_url"
    | "canva_brand_url";
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "website_url", label: "Website", Icon: Globe },
  { key: "instagram_url", label: "Instagram", Icon: AtSign },
  { key: "tiktok_url", label: "TikTok", Icon: Hash },
  { key: "facebook_url", label: "Facebook", Icon: LinkIcon },
  { key: "linkedin_url", label: "LinkedIn", Icon: LinkIcon },
  { key: "youtube_url", label: "YouTube", Icon: LinkIcon },
  { key: "google_drive_url", label: "Drive", Icon: ExternalLink },
  { key: "canva_brand_url", label: "Canva", Icon: ExternalLink },
];

const DOC_FIELDS: {
  manualKey:
    | "client_profile_doc_url"
    | "research_bible_doc_url"
    | "brand_voice_doc_url"
    | "strategy_brief_doc_url";
  label: string;
}[] = [
  { manualKey: "client_profile_doc_url", label: "Client Profile" },
  { manualKey: "research_bible_doc_url", label: "Research Bible" },
  { manualKey: "brand_voice_doc_url", label: "Brand Voice" },
  { manualKey: "strategy_brief_doc_url", label: "Strategy Brief" },
];

export default function ClientDetail({
  client,
  jobs,
  tasks,
  profiles,
  dates,
  clientFlowDocs,
}: {
  client: Client;
  jobs: Job[];
  tasks: Task[];
  profiles: Profile[];
  dates: ClientDate[];
  clientFlowDocs: ClientFlowDocs;
}) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileCollapsed, setProfileCollapsed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(jobs.map((j) => j.id))
  );

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }
  const storageKey = `client.${client.id}.expandedJobs`;
  const profileStorageKey = `client.${client.id}.profileCollapsed`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setExpanded(new Set(JSON.parse(raw)));
      const rawProfile = localStorage.getItem(profileStorageKey);
      if (rawProfile) setProfileCollapsed(rawProfile === "1");
    } catch {}
    // Only on mount per client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(expanded)));
    } catch {}
  }, [expanded, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(profileStorageKey, profileCollapsed ? "1" : "0");
    } catch {}
  }, [profileCollapsed, profileStorageKey]);

  // Reset image-failed state when the URL changes.
  useEffect(() => {
    setImgFailed(false);
  }, [client.profile_pic_url]);

  function toggleJob(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleLinks = LINK_FIELDS.filter((f) => client[f.key]);

  return (
    <div>
      <Link
        href="/clients"
        className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-3 inline-block"
      >
        ← All clients
      </Link>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <button
            onClick={() => setProfileCollapsed((v) => !v)}
            className="flex items-start gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
            aria-expanded={!profileCollapsed}
            aria-label={`${profileCollapsed ? "Expand" : "Collapse"} profile`}
          >
            {profileCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-1.5 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-1.5 flex-shrink-0" />
            )}
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {client.profile_pic_url && !imgFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={client.profile_pic_url}
                  alt={client.name}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                  style={{ backgroundColor: client.color }}
                >
                  {client.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-bold leading-tight">{client.name}</h2>
                {client.business_name && (
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-0.5">
                    {client.business_name}
                  </p>
                )}
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  {jobs.length} total {jobs.length === 1 ? "job" : "jobs"}
                </p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setEditingProfile(true)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit profile
          </button>
        </div>

        {!profileCollapsed && client.about && (
          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap mt-4 leading-relaxed">
            {client.about}
          </p>
        )}

        {!profileCollapsed && visibleLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {visibleLinks.map(({ key, label, Icon }) => (
              <a
                key={key}
                href={client[key] as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </a>
            ))}
          </div>
        )}

        {!profileCollapsed && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium mb-2">
              Strategy documents
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {DOC_FIELDS.map(({ manualKey, label }) => {
                const manual = client[manualKey];
                const fromFlow = clientFlowDocs[manualKey];
                const url = manual || fromFlow;
                const source = manual
                  ? "manual"
                  : fromFlow
                  ? "client-flow"
                  : null;
                return (
                  <div
                    key={manualKey}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                        {label}
                      </span>
                      {source === "client-flow" && (
                        <span
                          title="Auto-pulled from the client-flow app"
                          className="text-[10px] uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded"
                        >
                          Auto
                        </span>
                      )}
                      {source === "manual" && (
                        <span
                          title="Manual override set in Edit profile"
                          className="text-[10px] uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded"
                        >
                          Manual
                        </span>
                      )}
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline-offset-2 hover:underline flex items-center gap-1 flex-shrink-0"
                      >
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic flex-shrink-0">
                        Not set
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <KeyDatesSection clientId={client.id} dates={dates} />

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Jobs</h3>
        <NewJobButton clientId={client.id} />
      </div>

      <div className="space-y-3">
        {jobs.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              No jobs yet. Click &quot;New job&quot; to start.
            </p>
          </div>
        )}
        {jobs.map((job) => {
          const jobTasks = tasks.filter((t) => t.job_id === job.id);
          const doneTasks = jobTasks.filter(
            (t) => t.status === "closed_out" || t.status === "published"
          ).length;
          const pct = jobTasks.length
            ? Math.round((doneTasks / jobTasks.length) * 100)
            : 0;
          const isExpanded = expanded.has(job.id);
          const jobTaskIds = jobTasks.map((t) => t.id);
          const allSelected =
            jobTaskIds.length > 0 && jobTaskIds.every((id) => selected.has(id));
          const someSelected = jobTaskIds.some((id) => selected.has(id));
          return (
            <div
              key={job.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="flex items-center gap-2 p-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={(e) => toggleSelectAll(jobTaskIds, e.target.checked)}
                  disabled={jobTaskIds.length === 0}
                  className="rounded cursor-pointer flex-shrink-0"
                  aria-label={`Select all tasks in ${job.name}`}
                />
                <button
                  onClick={() => toggleJob(job.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${job.name}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  )}
                  <ProgressDonut percent={pct} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1 truncate">{job.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                      <span>
                        {doneTasks}/{jobTasks.length} tasks done
                      </span>
                      {job.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(job.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <Link
                  href={`/clients/${client.id}/jobs/${job.id}`}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline-offset-2 hover:underline px-2 py-1"
                >
                  Open
                </Link>
              </div>
              {isExpanded && (
                <JobTasksSection
                  jobId={job.id}
                  tasks={jobTasks}
                  client={client}
                  job={job}
                  profiles={profiles}
                  selected={selected}
                  onToggleSelected={toggleSelected}
                />
              )}
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <BulkActionBar
          selectedIds={Array.from(selected)}
          profiles={profiles}
          onClear={clearSelection}
        />
      )}

      {editingProfile && (
        <Modal title={`Edit ${client.name}`} onClose={() => setEditingProfile(false)}>
          <ClientProfileForm
            client={client}
            onSubmit={async (input) => {
              await updateClient(client.id, input);
              setEditingProfile(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function JobTasksSection({
  jobId,
  tasks,
  client,
  job,
  profiles,
  selected,
  onToggleSelected,
}: {
  jobId: string;
  tasks: Task[];
  client: Client;
  job: Job;
  profiles: Profile[];
  selected: Set<string>;
  onToggleSelected: (id: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40/40">
      <div className="flex items-center justify-between px-5 py-2">
        <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">
          Tasks
        </span>
        <button
          onClick={() => setShowNew(true)}
          className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add task
        </button>
      </div>
      <div className="divide-y divide-slate-100 bg-white dark:bg-slate-900">
        <TaskGridHeader />
        {tasks.length === 0 && (
          <p className="px-5 py-3 text-xs text-slate-400 dark:text-slate-500 italic">No tasks yet.</p>
        )}
        {tasks.map((task) => (
          <TaskGridRow
            key={task.id}
            task={task}
            job={job}
            client={client}
            profiles={profiles}
            selected={selected.has(task.id)}
            onToggleSelected={() => onToggleSelected(task.id)}
          />
        ))}
      </div>

      {showNew && (
        <Modal title="New task" onClose={() => setShowNew(false)}>
          <TaskForm
            profiles={profiles}
            onSubmit={async (input) => {
              await createTask(jobId, input);
              setShowNew(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function KeyDatesSection({
  clientId,
  dates,
}: {
  clientId: string;
  dates: ClientDate[];
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClientDate | null>(null);

  // Show upcoming first (today onward), then a "past" section if any.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = dates.filter((d) => d.date >= today);
  const past = dates.filter((d) => d.date < today).reverse();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Key dates</h3>
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add date
        </button>
      </div>

      {dates.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic">
          No dates yet — launches, content drops, anniversaries…
        </p>
      ) : (
        <div className="space-y-1">
          {upcoming.map((d) => (
            <DateRow key={d.id} d={d} onEdit={() => setEditing(d)} />
          ))}
          {upcoming.length > 0 && past.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 my-2" />
          )}
          {past.map((d) => (
            <DateRow key={d.id} d={d} onEdit={() => setEditing(d)} past />
          ))}
        </div>
      )}

      {adding && (
        <Modal title="Add a date" onClose={() => setAdding(false)}>
          <ClientDateForm
            onSubmit={async (input) => {
              await createClientDate(clientId, input);
              setAdding(false);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit date" onClose={() => setEditing(null)}>
          <ClientDateForm
            initial={editing}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              await updateClientDate(editing.id, input);
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function DateRow({
  d,
  onEdit,
  past = false,
}: {
  d: ClientDate;
  onEdit: () => void;
  past?: boolean;
}) {
  const [, startTransition] = useTransition();
  const date = new Date(d.date + "T00:00:00");
  return (
    <div
      className={`flex items-center gap-3 py-1.5 px-2 -mx-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 group ${
        past ? "opacity-60" : ""
      }`}
    >
      <div className="w-12 flex-shrink-0 text-center">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">
          {date.toLocaleDateString("en-ZA", { month: "short" })}
        </div>
        <div className="text-lg font-semibold leading-none">
          {date.getDate()}
        </div>
      </div>
      <button
        onClick={onEdit}
        className="flex-1 min-w-0 text-left"
      >
        <div className="text-sm font-medium truncate">{d.title}</div>
        {d.notes && (
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {d.notes}
          </div>
        )}
      </button>
      <button
        onClick={() => {
          if (confirm(`Delete "${d.title}"?`)) {
            startTransition(() => deleteClientDate(d.id));
          }
        }}
        className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-rose-600 p-1"
        aria-label="Delete date"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
