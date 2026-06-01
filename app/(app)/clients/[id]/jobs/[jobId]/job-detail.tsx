"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar, Plus, Trash2, User, X } from "lucide-react";
import Modal from "@/components/modal";
import { TaskForm, DeliverableForm } from "@/components/forms";
import {
  STAGES,
  TASK_STATUSES,
  DELIVERABLE_STATUSES,
  type StageId,
  type TaskStatusId,
  type DeliverableStatusId,
} from "@/lib/constants";
import type { Client, Deliverable, Job, Profile, Task } from "@/lib/types";
import { formatDate, isOverdue } from "@/lib/utils";
import { deleteJob, updateJobStage } from "@/app/actions/jobs";
import {
  createTask,
  deleteTask,
  updateTask,
  updateTaskStatus,
} from "@/app/actions/tasks";
import {
  createDeliverable,
  updateDeliverableStatus,
} from "@/app/actions/deliverables";

export default function JobDetail({
  job,
  client,
  tasks,
  deliverables,
  profiles,
}: {
  job: Job;
  client: Client;
  tasks: Task[];
  deliverables: Deliverable[];
  profiles: Profile[];
}) {
  const router = useRouter();
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewDel, setShowNewDel] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  const stageIndex = STAGES.findIndex((s) => s.id === job.stage);

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-sm text-slate-500 mb-1">{client.name}</div>
          <h2 className="text-2xl font-bold">{job.name}</h2>
          {job.due_date && (
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Due {formatDate(job.due_date)}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            if (confirm("Delete this job and all its tasks?")) {
              startTransition(async () => {
                await deleteJob(job.id);
                router.push(`/clients/${client.id}`);
              });
            }
          }}
          className="text-slate-400 hover:text-rose-600 p-2"
          aria-label="Delete job"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="font-semibold mb-3 text-sm text-slate-600">Stage</h3>
        <div className="flex items-center gap-1 flex-wrap">
          {STAGES.map((stage, i) => {
            const isActive = job.stage === stage.id;
            const isPast = i < stageIndex;
            return (
              <button
                key={stage.id}
                onClick={() =>
                  startTransition(() =>
                    updateJobStage(job.id, stage.id as StageId)
                  )
                }
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                  isActive
                    ? stage.color + " ring-2 ring-offset-1 ring-slate-900"
                    : isPast
                    ? "bg-slate-100 text-slate-500 border-slate-200"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {stage.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Tasks</h3>
            <button
              onClick={() => setShowNewTask(true)}
              className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 && (
              <p className="text-sm text-slate-400 italic">No tasks yet.</p>
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
                <div key={task.id} className="p-3 rounded border border-slate-200 group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-tight">{task.title}</p>
                      {task.notes && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingTask(task)}
                      className="opacity-0 group-hover:opacity-100 text-xs text-slate-500 hover:text-slate-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        startTransition(() => deleteTask(task.id))
                      }
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600"
                    >
                      <X className="w-4 h-4" />
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
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Deliverables</h3>
            <button
              onClick={() => setShowNewDel(true)}
              className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {deliverables.length === 0 && (
              <p className="text-sm text-slate-400 italic">No deliverables yet.</p>
            )}
            {deliverables.map((d) => {
              const status =
                DELIVERABLE_STATUSES.find((s) => s.id === d.status) ??
                DELIVERABLE_STATUSES[0];
              return (
                <div key={d.id} className="p-3 rounded border border-slate-200">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <p className="text-sm font-medium">{d.name}</p>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <select
                    value={d.status}
                    onChange={(e) =>
                      startTransition(() =>
                        updateDeliverableStatus(
                          d.id,
                          e.target.value as DeliverableStatusId
                        )
                      )
                    }
                    className="text-xs w-full border border-slate-200 rounded px-2 py-1"
                  >
                    {DELIVERABLE_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showNewTask && (
        <Modal title="New task" onClose={() => setShowNewTask(false)}>
          <TaskForm
            profiles={profiles}
            onSubmit={async (input) => {
              await createTask(job.id, input);
              setShowNewTask(false);
            }}
          />
        </Modal>
      )}
      {showNewDel && (
        <Modal title="New deliverable" onClose={() => setShowNewDel(false)}>
          <DeliverableForm
            onSubmit={async (name) => {
              await createDeliverable(job.id, name);
              setShowNewDel(false);
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
