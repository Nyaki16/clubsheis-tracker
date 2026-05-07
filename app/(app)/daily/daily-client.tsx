"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Calendar, ChevronDown, ChevronRight, Filter, Plus, Search, UserCog, X } from "lucide-react";
import Modal from "@/components/modal";
import { JobForm } from "@/components/forms";
import { TASK_STATUSES, type TaskStatusId } from "@/lib/constants";
import type { Client, Job, Profile, Task } from "@/lib/types";
import { isOverdue, isThisWeek, isToday, formatDate } from "@/lib/utils";
import {
  createTask,
  deleteTask,
  updateTask,
  updateTaskStatus,
} from "@/app/actions/tasks";
import { createJob } from "@/app/actions/jobs";

type SortKey = "client" | "task" | "due" | "status";
type SortDir = "asc" | "desc";
type GroupBy = "assignee" | "client" | "none";

type Group = {
  key: string;
  label: string;
  avatarText: string;
  avatarBg: string;
  dotColor?: string;
  groupAssigneeId: string | null;
  groupClientId: string | null;
  list: Task[];
};

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
  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDue, setFilterDue] = useState("all");
  const [hideClosed, setHideClosed] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>("assignee");
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showNewJob, setShowNewJob] = useState(false);

  const getJob = (id: string) => jobs.find((j) => j.id === id);
  const getClient = (id: string) => clients.find((c) => c.id === id);
  const getProfile = (id: string | null) =>
    id ? profiles.find((p) => p.id === id) ?? null : null;

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
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
      if (q) {
        const job = getJob(t.job_id);
        const client = job ? getClient(job.client_id) : null;
        const hay = `${t.title} ${t.notes ?? ""} ${client?.name ?? ""} ${job?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, jobs, clients, search, filterAssignee, filterClient, filterStatus, filterDue, hideClosed]);

  const sortFn = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const statusOrder = new Map(TASK_STATUSES.map((s, i) => [s.id, i]));
    return (a: Task, b: Task) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "client") {
        const ja = getJob(a.job_id);
        const jb = getJob(b.job_id);
        av = (ja ? getClient(ja.client_id)?.name : "") ?? "";
        bv = (jb ? getClient(jb.client_id)?.name : "") ?? "";
      } else if (sortKey === "task") {
        av = a.title.toLowerCase();
        bv = b.title.toLowerCase();
      } else if (sortKey === "status") {
        av = statusOrder.get(a.status) ?? 99;
        bv = statusOrder.get(b.status) ?? 99;
      } else {
        // due
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return (new Date(a.due_date).getTime() - new Date(b.due_date).getTime()) * dir;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sortDir, jobs, clients]);

  const groups: Group[] = useMemo(() => {
    if (groupBy === "none") {
      const list = [...filteredTasks].sort(sortFn);
      return [
        {
          key: "__all__",
          label: "All tasks",
          avatarText: "",
          avatarBg: "bg-slate-400",
          groupAssigneeId: null,
          groupClientId: null,
          list,
        },
      ];
    }
    if (groupBy === "client") {
      const map = new Map<string, Task[]>();
      clients.forEach((c) => map.set(c.id, []));
      map.set("__no_client__", []);
      filteredTasks.forEach((t) => {
        const job = getJob(t.job_id);
        const key = job && map.has(job.client_id) ? job.client_id : "__no_client__";
        map.get(key)!.push(t);
      });
      map.forEach((list) => list.sort(sortFn));
      return Array.from(map.entries()).map(([key, list]) => {
        const c = key === "__no_client__" ? null : getClient(key) ?? null;
        return {
          key,
          label: c?.name ?? "No client",
          avatarText: (c?.name ?? "?")[0]?.toUpperCase() ?? "?",
          avatarBg: c ? "" : "bg-slate-400",
          groupAssigneeId: null,
          groupClientId: c ? c.id : null,
          list,
          // bg dot color for client
          ...(c ? { dotColor: c.color } : {}),
        } as Group & { dotColor?: string };
      });
    }
    // assignee (default)
    const map = new Map<string, Task[]>();
    profiles.forEach((p) => map.set(p.id, []));
    map.set("__unassigned__", []);
    filteredTasks.forEach((t) => {
      const key = t.assignee_id && map.has(t.assignee_id) ? t.assignee_id : "__unassigned__";
      map.get(key)!.push(t);
    });
    map.forEach((list) => list.sort(sortFn));
    return Array.from(map.entries()).map(([key, list]) => {
      const p = key === "__unassigned__" ? null : getProfile(key);
      const label = p?.name ?? "Unassigned";
      return {
        key,
        label,
        avatarText: label[0]?.toUpperCase() ?? "?",
        avatarBg: p
          ? "bg-gradient-to-br from-purple-500 to-pink-500"
          : "bg-slate-400",
        groupAssigneeId: key === "__unassigned__" ? null : key,
        groupClientId: null,
        list,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTasks, profiles, clients, sortFn, groupBy]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold mb-1">Daily Scroll</h2>
          <p className="text-slate-500 text-sm">
            Every task, grouped how you need it. Edit anything inline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewJob(true)}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" /> New job
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 sticky top-[68px] z-10">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, notes, client, job…"
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
        <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Group by</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(["assignee", "client", "none"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium capitalize ${
                    groupBy === g
                      ? "bg-white shadow-sm text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {g === "none" ? "None" : g}
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Showing{" "}
            <strong className="text-slate-900">{filteredTasks.length}</strong>{" "}
            {filteredTasks.length === 1 ? "task" : "tasks"}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((g) => (
          <div
            key={g.key}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {g.dotColor ? (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: g.dotColor }}
                  >
                    {g.avatarText}
                  </div>
                ) : g.avatarText ? (
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${g.avatarBg}`}
                  >
                    {g.avatarText}
                  </div>
                ) : null}
                <h3 className="font-semibold">{g.label}</h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {g.list.length} {g.list.length === 1 ? "task" : "tasks"}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              {g.list.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  job={getJob(task.job_id) ?? null}
                  client={
                    getJob(task.job_id)
                      ? getClient(getJob(task.job_id)!.client_id) ?? null
                      : null
                  }
                  profiles={profiles}
                />
              ))}
              {g.list.length === 0 && (
                <div className="px-5 py-3 text-xs text-slate-400 italic">
                  No tasks yet — add one below.
                </div>
              )}
              <NewTaskRow
                groupAssigneeId={g.groupAssigneeId}
                groupClientId={g.groupClientId}
                clients={clients}
                jobs={jobs}
              />
            </div>
          </div>
        ))}
        {filteredTasks.length === 0 && groups.every((g) => g.list.length === 0) && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <p className="text-slate-500 text-sm">No tasks match these filters.</p>
          </div>
        )}
      </div>

      {showNewJob && (
        <Modal title="New job" onClose={() => setShowNewJob(false)}>
          <JobForm
            clients={clients}
            onSubmit={async (name, dueDate, clientId, templateId) => {
              if (!clientId) return;
              await createJob(clientId, name, dueDate || null, templateId);
              setShowNewJob(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function SortHeader({
  sortKey,
  sortDir,
  onSort,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const arrow = (k: SortKey) =>
    sortKey === k ? (
      sortDir === "asc" ? (
        <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3" />
      )
    ) : null;

  const cell = "flex items-center gap-1 hover:text-slate-700";

  return (
    <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2 text-xs uppercase tracking-wide text-slate-400 font-medium bg-slate-50/50">
      <button onClick={() => onSort("client")} className={`col-span-2 ${cell}`}>
        Client {arrow("client")}
      </button>
      <button onClick={() => onSort("task")} className={`col-span-3 ${cell}`}>
        Task {arrow("task")}
      </button>
      <div className="col-span-3">Notes</div>
      <button onClick={() => onSort("due")} className={`col-span-2 ${cell}`}>
        Due {arrow("due")}
      </button>
      <button onClick={() => onSort("status")} className={`col-span-2 ${cell}`}>
        Status {arrow("status")}
      </button>
    </div>
  );
}

function TaskRow({
  task,
  job,
  client,
  profiles,
}: {
  task: Task;
  job: Job | null;
  client: Client | null;
  profiles: Profile[];
}) {
  const [, startTransition] = useTransition();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [editingDate, setEditingDate] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(task.notes ?? "");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  // Keep drafts in sync if server data changes after re-render
  useEffect(() => setTitleDraft(task.title), [task.title]);
  useEffect(() => setNotesDraft(task.notes ?? ""), [task.notes]);

  const status =
    TASK_STATUSES.find((s) => s.id === task.status) ?? TASK_STATUSES[0];
  const overdue =
    isOverdue(task.due_date) &&
    task.status !== "closed_out" &&
    task.status !== "published";

  function saveTitle() {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (!next || next === task.title) {
      setTitleDraft(task.title);
      return;
    }
    startTransition(() => updateTask(task.id, { title: next }));
  }

  function saveNotes() {
    setEditingNotes(false);
    if (notesDraft === (task.notes ?? "")) return;
    startTransition(() => updateTask(task.id, { notes: notesDraft }));
  }

  function saveDate(value: string) {
    setEditingDate(false);
    if (value === (task.due_date ?? "")) return;
    startTransition(() => updateTask(task.id, { due_date: value }));
  }

  function reassign(assigneeId: string | null) {
    setReassigning(false);
    if (assigneeId === task.assignee_id) return;
    startTransition(() => updateTask(task.id, { assignee_id: assigneeId }));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-3 hover:bg-slate-50 group items-start">
      <div className="md:col-span-2 flex items-center gap-2 min-w-0 pt-1">
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

      <div className="md:col-span-3 min-w-0">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") {
                setTitleDraft(task.title);
                setEditingTitle(false);
              }
            }}
            className="w-full text-sm font-medium leading-tight border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-900"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="text-left text-sm font-medium leading-tight hover:bg-slate-100 rounded px-1.5 py-0.5 -mx-1.5 w-full truncate"
          >
            {task.title}
          </button>
        )}
        {job && <p className="text-xs text-slate-500 mt-0.5 px-1.5">{job.name}</p>}
      </div>

      <div className="md:col-span-3 min-w-0 pt-1">
        {editingNotes ? (
          <textarea
            autoFocus
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setNotesDraft(task.notes ?? "");
                setEditingNotes(false);
              }
            }}
            rows={4}
            placeholder="Notes…"
            className="w-full text-xs text-slate-700 border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:border-slate-900 resize-y"
          />
        ) : task.notes ? (
          <button
            onClick={() => {
              if (!notesExpanded) {
                setNotesExpanded(true);
              } else {
                setEditingNotes(true);
              }
            }}
            className="flex items-start gap-1 text-left text-xs text-slate-600 hover:bg-slate-100 rounded px-1.5 py-0.5 -mx-1.5 w-full"
            title={notesExpanded ? "Click to edit" : "Click to expand"}
          >
            {notesExpanded ? (
              <ChevronDown className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
            )}
            <span className={notesExpanded ? "whitespace-pre-wrap" : "truncate"}>
              {task.notes}
            </span>
          </button>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className="text-xs text-slate-400 hover:text-slate-700 px-1.5 -mx-1.5"
          >
            + add note
          </button>
        )}
      </div>

      <div className="md:col-span-2 pt-1">
        {editingDate ? (
          <input
            type="date"
            autoFocus
            defaultValue={task.due_date ?? ""}
            onBlur={(e) => saveDate(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveDate((e.target as HTMLInputElement).value);
              if (e.key === "Escape") setEditingDate(false);
            }}
            className="w-full text-sm border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-900"
          />
        ) : task.due_date ? (
          <button
            onClick={() => setEditingDate(true)}
            className={`text-sm flex items-center gap-1 hover:bg-slate-100 rounded px-1.5 py-0.5 -mx-1.5 ${
              overdue ? "text-rose-600 font-medium" : "text-slate-600"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(task.due_date)}
          </button>
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            className="text-xs text-slate-400 hover:text-slate-700 px-1.5 -mx-1.5"
          >
            + set date
          </button>
        )}
      </div>

      <div className="md:col-span-2 flex items-center gap-1 pt-0.5 relative">
        <select
          value={task.status}
          onChange={(e) =>
            startTransition(() =>
              updateTaskStatus(task.id, e.target.value as TaskStatusId)
            )
          }
          className={`text-xs font-medium border rounded-md px-2 py-1 flex-1 min-w-0 ${status.color}`}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setReassigning((v) => !v)}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-900 p-1"
          title="Reassign"
        >
          <UserCog className="w-4 h-4" />
        </button>
        {reassigning && (
          <ReassignPopover
            currentId={task.assignee_id}
            profiles={profiles}
            onPick={reassign}
            onClose={() => setReassigning(false)}
          />
        )}
        <button
          onClick={() => {
            if (confirm("Delete this task?"))
              startTransition(() => deleteTask(task.id));
          }}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ReassignPopover({
  currentId,
  profiles,
  onPick,
  onClose,
}: {
  currentId: string | null;
  profiles: Profile[];
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg w-44 py-1"
    >
      <button
        onClick={() => onPick(null)}
        className={`w-full text-left text-xs px-3 py-1.5 hover:bg-slate-100 ${
          currentId === null ? "font-semibold text-slate-900" : "text-slate-600"
        }`}
      >
        Unassigned
      </button>
      {profiles.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p.id)}
          className={`w-full text-left text-xs px-3 py-1.5 hover:bg-slate-100 ${
            currentId === p.id ? "font-semibold text-slate-900" : "text-slate-600"
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

function NewTaskRow({
  groupAssigneeId,
  groupClientId,
  clients,
  jobs,
}: {
  groupAssigneeId: string | null;
  groupClientId: string | null;
  clients: Client[];
  jobs: Job[];
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(groupClientId ?? "");
  const [jobId, setJobId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<TaskStatusId>("planning");
  const [pending, startTransition] = useTransition();

  // Keep client in sync when the group's pre-fill changes (e.g. switching grouping mode)
  useEffect(() => {
    if (groupClientId) setClientId(groupClientId);
  }, [groupClientId]);

  const filteredJobs = jobs.filter((j) => j.client_id === clientId);
  const canSubmit = title.trim() && jobId;

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      await createTask(jobId, {
        title: title.trim(),
        assignee_id: groupAssigneeId,
        due_date: dueDate || null,
        notes,
        status,
      });
      setTitle("");
      setClientId(groupClientId ?? "");
      setJobId("");
      setDueDate("");
      setNotes("");
      setStatus("planning");
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50/50 items-center">
      <div className="md:col-span-2">
        <select
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setJobId("");
          }}
          className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white"
        >
          <option value="">Client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-3 flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) submit();
          }}
          placeholder="Add a task…"
          className="flex-1 text-sm border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-slate-900 min-w-0"
        />
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          disabled={!clientId}
          className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white max-w-[120px]"
        >
          <option value="">{clientId ? "Job…" : "Pick client"}</option>
          {filteredJobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-3">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) submit();
          }}
          placeholder="Notes (optional)"
          className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-slate-900"
        />
      </div>
      <div className="md:col-span-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white"
        />
      </div>
      <div className="md:col-span-2 flex items-center gap-1">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatusId)}
          className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-1 bg-white min-w-0"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={submit}
          disabled={!canSubmit || pending}
          className="bg-slate-900 text-white text-xs px-2 py-1 rounded font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> {pending ? "…" : "Add"}
        </button>
      </div>
    </div>
  );
}
