"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { TASK_STATUSES, type TaskStatusId } from "@/lib/constants";
import type { Client, Job, Task } from "@/lib/types";
import { updateTaskStatus } from "@/app/actions/tasks";

export default function PipelineBoard({
  tasks: serverTasks,
  jobs,
  clients,
}: {
  tasks: Task[];
  jobs: Job[];
  clients: Client[];
}) {
  // Local mirror so a drop reflects instantly (server action revalidates in
  // the background and the prop syncs on the next render).
  const [tasks, setTasks] = useState(serverTasks);
  const [, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<TaskStatusId | null>(null);

  // If the server data shifts (after a save → revalidate), reconcile.
  // Server is the source of truth, but never clobber an in-flight drag.
  useEffect(() => {
    if (!draggingId) setTasks(serverTasks);
  }, [serverTasks, draggingId]);

  const getJob = (id: string) => jobs.find((j) => j.id === id);
  const getClient = (id: string) => clients.find((c) => c.id === id);

  function moveTask(taskId: string, toStatus: TaskStatusId) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: toStatus } : t))
    );
    startTransition(async () => {
      try {
        await updateTaskStatus(taskId, toStatus);
      } catch {
        // Rollback to server state on failure.
        setTasks(serverTasks);
      }
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Pipeline</h2>
        <p className="text-slate-500 text-sm">
          Tasks across all clients, by status. Drag a card to move it.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {TASK_STATUSES.map((status) => {
          const colTasks = tasks.filter((t) => t.status === status.id);
          const isHover = hoverCol === status.id;
          return (
            <div
              key={status.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (hoverCol !== status.id) setHoverCol(status.id);
              }}
              onDragLeave={(e) => {
                // Only clear when leaving the column wrapper, not children.
                if (!(e.currentTarget as HTMLDivElement).contains(e.relatedTarget as Node | null)) {
                  setHoverCol((cur) => (cur === status.id ? null : cur));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/task-id");
                setHoverCol(null);
                setDraggingId(null);
                if (!taskId) return;
                const t = tasks.find((x) => x.id === taskId);
                if (!t || t.status === status.id) return;
                moveTask(taskId, status.id);
              }}
              className={`bg-white rounded-xl border p-3 transition-colors ${
                isHover ? "border-slate-900 bg-slate-50" : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${status.color}`}
                >
                  {status.label}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-2 min-h-[40px]">
                {colTasks.map((task) => {
                  const job = getJob(task.job_id);
                  const client = job ? getClient(job.client_id) : null;
                  const isDragging = draggingId === task.id;
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/task-id", task.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(task.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setHoverCol(null);
                      }}
                      className={`p-2 rounded border bg-white cursor-grab active:cursor-grabbing select-none ${
                        isDragging
                          ? "border-slate-400 opacity-50"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {client && (
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: client.color }}
                          />
                        )}
                        <p className="text-xs text-slate-500 truncate">
                          {client?.name ?? "—"}
                        </p>
                      </div>
                      <p className="text-sm font-medium leading-tight mb-1">
                        {task.title}
                      </p>
                      {job && (
                        <Link
                          href={`/clients/${job.client_id}/jobs/${job.id}`}
                          className="text-[11px] text-slate-400 hover:text-slate-700 truncate inline-block max-w-full"
                          onClick={(e) => e.stopPropagation()}
                          draggable={false}
                        >
                          {job.name}
                        </Link>
                      )}
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <p className="text-xs text-slate-400 italic px-1">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
