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
  User,
} from "lucide-react";
import Link from "next/link";
import Modal from "@/components/modal";
import { ClientProfileForm, TaskForm } from "@/components/forms";
import NewJobButton from "./new-job-button";
import {
  STAGES,
  TASK_STATUSES,
  type TaskStatusId,
} from "@/lib/constants";
import type { Client, ClientFlowDocs, Job, Profile, Task } from "@/lib/types";
import { formatDate, isOverdue } from "@/lib/utils";
import { updateClient } from "@/app/actions/clients";
import {
  createTask,
  deleteTask,
  updateTask,
  updateTaskStatus,
} from "@/app/actions/tasks";

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
  clientFlowDocs,
}: {
  client: Client;
  jobs: Job[];
  tasks: Task[];
  profiles: Profile[];
  clientFlowDocs: ClientFlowDocs;
}) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileCollapsed, setProfileCollapsed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(jobs.map((j) => j.id))
  );
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
        className="text-sm text-slate-500 hover:text-slate-900 mb-3 inline-block"
      >
        ← All clients
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <button
            onClick={() => setProfileCollapsed((v) => !v)}
            className="flex items-start gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
            aria-expanded={!profileCollapsed}
            aria-label={`${profileCollapsed ? "Expand" : "Collapse"} profile`}
          >
            {profileCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-400 mt-1.5 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 mt-1.5 flex-shrink-0" />
            )}
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {client.profile_pic_url && !imgFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={client.profile_pic_url}
                  alt={client.name}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-200 flex-shrink-0"
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
                  <p className="text-slate-600 text-sm mt-0.5">
                    {client.business_name}
                  </p>
                )}
                <p className="text-slate-500 text-xs mt-1">
                  {jobs.length} total {jobs.length === 1 ? "job" : "jobs"}
                </p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setEditingProfile(true)}
            className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 hover:bg-slate-50"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit profile
          </button>
        </div>

        {!profileCollapsed && client.about && (
          <p className="text-sm text-slate-600 whitespace-pre-wrap mt-4 leading-relaxed">
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
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </a>
            ))}
          </div>
        )}

        {!profileCollapsed && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
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
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-700 truncate">
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
                          className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded"
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
                        className="text-xs font-medium text-slate-700 hover:text-slate-900 underline-offset-2 hover:underline flex items-center gap-1 flex-shrink-0"
                      >
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic flex-shrink-0">
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

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Jobs</h3>
        <NewJobButton clientId={client.id} />
      </div>

      <div className="space-y-3">
        {jobs.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="text-slate-500 text-sm">
              No jobs yet. Click &quot;New job&quot; to start.
            </p>
          </div>
        )}
        {jobs.map((job) => {
          const stage = STAGES.find((s) => s.id === job.stage);
          const jobTasks = tasks.filter((t) => t.job_id === job.id);
          const doneTasks = jobTasks.filter(
            (t) => t.status === "closed_out" || t.status === "published"
          ).length;
          const isExpanded = expanded.has(job.id);
          return (
            <div
              key={job.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              <div className="flex items-center gap-2 p-4">
                <button
                  onClick={() => toggleJob(job.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${job.name}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-semibold">{job.name}</h3>
                      {stage && (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${stage.color}`}
                        >
                          {stage.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
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
                  className="text-xs text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline px-2 py-1"
                >
                  Open
                </Link>
              </div>
              {isExpanded && (
                <JobTasksSection
                  jobId={job.id}
                  tasks={jobTasks}
                  profiles={profiles}
                />
              )}
            </div>
          );
        })}
      </div>

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
  profiles,
}: {
  jobId: string;
  tasks: Task[];
  profiles: Profile[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-slate-500 font-medium">
          Tasks
        </span>
        <button
          onClick={() => setShowNew(true)}
          className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add task
        </button>
      </div>
      <div className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-xs text-slate-400 italic">No tasks yet.</p>
        )}
        {tasks.map((task) => {
          const status =
            TASK_STATUSES.find((s) => s.id === task.status) ?? TASK_STATUSES[0];
          const overdue =
            isOverdue(task.due_date) &&
            task.status !== "closed_out" &&
            task.status !== "published";
          const assignee = task.assignee_id
            ? profiles.find((p) => p.id === task.assignee_id) ?? null
            : null;
          return (
            <div
              key={task.id}
              className="p-3 rounded border border-slate-200 bg-white group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{task.title}</p>
                  {task.notes && (
                    <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">
                      {task.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setEditingTask(task)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-slate-500 hover:text-slate-900"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this task?")) {
                      startTransition(() => deleteTask(task.id));
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {assignee && (
                  <span className="text-xs text-slate-600 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {assignee.name}
                  </span>
                )}
                {task.due_date && (
                  <span
                    className={`text-xs flex items-center gap-1 ${
                      overdue ? "text-rose-600 font-medium" : "text-slate-500"
                    }`}
                  >
                    <Calendar className="w-3 h-3" /> {formatDate(task.due_date)}
                  </span>
                )}
                <select
                  value={task.status}
                  onChange={(e) =>
                    startTransition(() =>
                      updateTaskStatus(task.id, e.target.value as TaskStatusId)
                    )
                  }
                  className={`text-xs font-medium border rounded px-1.5 py-0.5 ml-auto ${status.color}`}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
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
      {editingTask && (
        <Modal title="Edit task" onClose={() => setEditingTask(null)}>
          <TaskForm
            profiles={profiles}
            initial={editingTask}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              await updateTask(editingTask.id, input);
              setEditingTask(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
