"use client";

import { useMemo, useState, useTransition } from "react";
import { Calendar, FileText, Filter, Plus, X } from "lucide-react";
import Modal from "@/components/modal";
import { TaskForm } from "@/components/forms";
import { TASK_STATUSES, type TaskStatusId } from "@/lib/constants";
import type { Client, Job, Profile, Task } from "@/lib/types";
import { isOverdue, isThisWeek, isToday, formatDate } from "@/lib/utils";
import {
  createTask,
  deleteTask,
  updateTask,
  updateTaskStatus,
} from "@/app/actions/tasks";

export default function DailyClient({
  tasks,
  clients,
  jobs,
  profiles,
}: {
  tasks: Task[];
  clients: Client[];
  jobs: Job[];
  profiles: Profile[];
}) {
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDue, setFilterDue] = useState("all");
  const [hideClosed, setHideClosed] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const getJob = (id: string) => jobs.find((j) => j.id === id);
  const getClient = (id: string) => clients.find((c) => c.id === id);
  const getProfile = (id: string | null) =>
    id ? profiles.find((p) => p.id === id) ?? null : null;
  const getStatus = (id: string) =>
    TASK_STATUSES.find((s) => s.id === id) ?? TASK_STATUSES[0];

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (hideClosed && t.status === "closed_out") return false;
      if (filterAssignee !== "all") {
        if (filterAssignee === "unassigned" && t.assignee_id) return false;
        if (filterAssignee !== "unassigned" && t.assignee_id !== filterAssignee) return false;
      }
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterClient !== "all") {
        const job = getJob(t.job_id);
        if (!job || job.client_id !== filterClient) return false;
      }
      if (filterDue === "today" && !isToday(t.due_date)) return false;
      if (filterDue === "overdue" && !isOverdue(t.due_date)) return false;
      if (filterDue === "week" && !isThisWeek(t.due_date)) return false;
      if (filterDue === "no_date" && t.due_date) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, jobs, filterAssignee, filterClient, filterStatus, filterDue, hideClosed]);

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    profiles.forEach((p) => map.set(p.id, []));
    map.set("__unassigned__", []);
    filteredTasks.forEach((t) => {
      const key = t.assignee_id && map.has(t.assignee_id) ? t.assignee_id : "__unassigned__";
      map.get(key)!.push(t);
    });
    map.forEach((list) => {
      list.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    });
    return Array.from(map.entries());
  }, [filteredTasks, profiles]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold mb-1">Daily Scroll</h2>
          <p className="text-slate-500 text-sm">
            Every task, grouped by who owns it. Update status inline.
          </p>
        </div>
        <button
          onClick={() => setShowNewTask(true)}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" /> New task
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 sticky top-[68px] z-10">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Assignee</label>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="all">Everyone</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Client</label>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="all">All statuses</option>
              {TASK_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Due</label>
            <select
              value={filterDue}
              onChange={(e) => setFilterDue(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="all">Anytime</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="week">This week</option>
              <option value="no_date">No date</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={hideClosed}
                onChange={(e) => setHideClosed(e.target.checked)}
                className="rounded"
              />
              Hide closed out
            </label>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Showing{" "}
          <strong className="text-slate-900">{filteredTasks.length}</strong>{" "}
          {filteredTasks.length === 1 ? "task" : "tasks"}
        </div>
      </div>

      <div className="space-y-6">
        {groups.map(([key, list]) => {
          if (list.length === 0) return null;
          const profile = key === "__unassigned__" ? null : getProfile(key);
          const label = profile?.name ?? "Unassigned";
          return (
            <div
              key={key}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                      profile
                        ? "bg-gradient-to-br from-purple-500 to-pink-500"
                        : "bg-slate-400"
                    }`}
                  >
                    {label[0]?.toUpperCase()}
                  </div>
                  <h3 className="font-semibold">{label}</h3>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {list.length} {list.length === 1 ? "task" : "tasks"}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2 text-xs uppercase tracking-wide text-slate-400 font-medium bg-slate-50/50">
                  <div className="col-span-2">Client</div>
                  <div className="col-span-4">Task</div>
                  <div className="col-span-2">Due</div>
                  <div className="col-span-1">Notes</div>
                  <div className="col-span-3">Status</div>
                </div>
                {list.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    job={getJob(task.job_id) ?? null}
                    client={
                      getJob(task.job_id)
                        ? getClient(getJob(task.job_id)!.client_id) ?? null
                        : null
                    }
                    onEdit={() => setEditingTask(task)}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {filteredTasks.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <p className="text-slate-500 text-sm">No tasks match these filters.</p>
          </div>
        )}
      </div>

      {showNewTask && (
        <Modal title="New task" onClose={() => setShowNewTask(false)}>
          <TaskForm
            profiles={profiles}
            clients={clients}
            jobs={jobs}
            needsJobPicker
            onSubmit={async (input) => {
              if (!input.job_id) return;
              await createTask(input.job_id, {
                title: input.title,
                assignee_id: input.assignee_id,
                due_date: input.due_date,
                notes: input.notes,
                status: input.status,
              });
              setShowNewTask(false);
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

function TaskRow({
  task,
  job,
  client,
  onEdit,
}: {
  task: Task;
  job: Job | null;
  client: Client | null;
  onEdit: () => void;
}) {
  const [, startTransition] = useTransition();
  const status =
    TASK_STATUSES.find((s) => s.id === task.status) ?? TASK_STATUSES[0];
  const overdue =
    isOverdue(task.due_date) &&
    task.status !== "closed_out" &&
    task.status !== "published";

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-3 hover:bg-slate-50 group items-center">
      <div className="md:col-span-2 flex items-center gap-2 min-w-0">
        {client && (
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: client.color }}
          />
        )}
        <span className="text-sm text-slate-700 truncate">
          {client?.name ?? "—"}
        </span>
      </div>
      <div className="md:col-span-4">
        <p className="text-sm font-medium leading-tight">{task.title}</p>
        {job && <p className="text-xs text-slate-500 mt-0.5">{job.name}</p>}
      </div>
      <div className="md:col-span-2">
        {task.due_date ? (
          <span
            className={`text-sm flex items-center gap-1 ${
              overdue ? "text-rose-600 font-medium" : "text-slate-600"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(task.due_date)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">No date</span>
        )}
      </div>
      <div className="md:col-span-1">
        {task.notes ? (
          <button
            onClick={onEdit}
            className="text-slate-400 hover:text-slate-900"
            title={task.notes}
          >
            <FileText className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onEdit}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            + add
          </button>
        )}
      </div>
      <div className="md:col-span-3 flex items-center gap-2">
        <select
          value={task.status}
          onChange={(e) =>
            startTransition(() =>
              updateTaskStatus(task.id, e.target.value as TaskStatusId)
            )
          }
          className={`text-xs font-medium border rounded-md px-2 py-1 flex-1 ${status.color}`}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-900 text-xs"
        >
          Edit
        </button>
        <button
          onClick={() => {
            if (confirm("Delete this task?"))
              startTransition(() => deleteTask(task.id));
          }}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
