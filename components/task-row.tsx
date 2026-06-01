"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
  Star,
  UserCog,
  X,
} from "lucide-react";
import Avatar from "@/components/avatar";
import { TASK_STATUSES, type TaskStatusId } from "@/lib/constants";
import type { Client, Job, Profile, Task } from "@/lib/types";
import { formatDate, isOverdue } from "@/lib/utils";
import {
  deleteTask,
  toggleTaskPriority,
  updateTask,
  updateTaskStatus,
} from "@/app/actions/tasks";

export type SortKey = "client" | "task" | "due" | "status";
export type SortDir = "asc" | "desc";

// Short display string for a URL: "drive.google.com/…" → just the host.
function prettyUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

// Shared 12-column header for the Daily and Client task grids.
// `onSort` is optional — pass undefined to render a static (non-sortable) header.
export function TaskGridHeader({
  sortKey,
  sortDir,
  onSort,
}: {
  sortKey?: SortKey;
  sortDir?: SortDir;
  onSort?: (k: SortKey) => void;
}) {
  const arrow = (k: SortKey) =>
    onSort && sortKey === k ? (
      sortDir === "asc" ? (
        <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3" />
      )
    ) : null;

  const cell = "flex items-center gap-1 hover:text-slate-700";
  const ColButton = ({
    k,
    span,
    children,
  }: {
    k: SortKey;
    span: string;
    children: React.ReactNode;
  }) =>
    onSort ? (
      <button onClick={() => onSort(k)} className={`${span} ${cell}`}>
        {children} {arrow(k)}
      </button>
    ) : (
      <div className={span}>{children}</div>
    );

  return (
    <div className="hidden md:grid grid-cols-16 gap-3 px-5 py-2 text-xs uppercase tracking-wide text-slate-400 font-medium bg-slate-50/50">
      <ColButton k="client" span="col-span-2">
        Client
      </ColButton>
      <ColButton k="task" span="col-span-3">
        Task
      </ColButton>
      <div className="col-span-2">Notes</div>
      <div className="col-span-1">Link</div>
      <ColButton k="due" span="col-span-1">
        Due
      </ColButton>
      <div className="col-span-2">Assignee</div>
      <div className="col-span-2">Approval</div>
      <ColButton k="status" span="col-span-2">
        Status
      </ColButton>
    </div>
  );
}

// Per-assignee Top 3 star. Guards against the documented failure paths and
// surfaces a friendly message instead of Next's digested server error.
export function PriorityStar({ task }: { task: Task }) {
  const [pending, startTransition] = useTransition();
  const rank = task.priority_rank;
  const isSet = rank != null;
  const isAssigned = task.assignee_id != null;

  function toggle() {
    if (!isAssigned && !isSet) {
      alert("Assign this task to someone before marking it as Top 3.");
      return;
    }
    startTransition(async () => {
      try {
        await toggleTaskPriority(task.id);
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Could not update Top 3.";
        const friendly = /Server Components render|digest/i.test(raw)
          ? "Something went wrong updating Top 3. Try refreshing the page."
          : raw;
        alert(friendly);
      }
    });
  }

  const disabledForUnassigned = !isAssigned && !isSet;

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={
        isSet
          ? `Top 3 — priority ${rank}. Click to remove.`
          : disabledForUnassigned
          ? "Assign this task first to mark it as Top 3."
          : "Mark as Top 3 priority"
      }
      aria-label={isSet ? `Remove priority ${rank}` : "Mark as Top 3 priority"}
      className={`flex-shrink-0 inline-flex items-center justify-center rounded-md transition ${
        isSet
          ? "text-amber-600 hover:text-amber-700"
          : disabledForUnassigned
          ? "text-slate-200 cursor-not-allowed opacity-0 group-hover:opacity-100"
          : "text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100 focus:opacity-100"
      } ${pending ? "opacity-50" : ""}`}
    >
      {isSet ? (
        <span className="inline-flex items-center gap-0.5 bg-amber-100 border border-amber-300 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none">
          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
          {rank}
        </span>
      ) : (
        <Star className="w-4 h-4" />
      )}
    </button>
  );
}

function ReassignPopover({
  triggerRef,
  currentId,
  profiles,
  onPick,
  onClose,
}: {
  triggerRef: React.RefObject<HTMLElement | null>;
  currentId: string | null;
  profiles: Profile[];
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Position the popover under the trigger, right-aligned. Recompute on
  // scroll/resize so it tracks the page until closed.
  useLayoutEffect(() => {
    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = 176; // matches w-44
      const left = Math.max(
        8,
        Math.min(window.innerWidth - width - 8, rect.right - width)
      );
      setPos({ top: rect.bottom + 4, left });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [triggerRef]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      if (popRef.current && popRef.current.contains(target)) return;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose, triggerRef]);

  if (!mounted || !pos) return null;

  return createPortal(
    <div
      ref={popRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: 176,
        zIndex: 100,
      }}
      className="bg-white border border-slate-200 rounded-lg shadow-lg py-1"
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
          className={`w-full text-left text-xs px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 ${
            currentId === p.id ? "font-semibold text-slate-900" : "text-slate-600"
          }`}
        >
          <Avatar name={p.name} url={p.avatar_url} size="sm" />
          <span className="truncate">{p.name}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}

// 12-col grid row matching TaskGridHeader. Selection/checkbox is optional —
// the daily-scroll uses it for bulk actions; the client page hides it.
export function TaskGridRow({
  task,
  job,
  client,
  profiles,
  selected,
  onToggleSelected,
}: {
  task: Task;
  job: Job | null;
  client: Client | null;
  profiles: Profile[];
  selected?: boolean;
  onToggleSelected?: () => void;
}) {
  const [, startTransition] = useTransition();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [editingDate, setEditingDate] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(task.notes ?? "");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(task.url ?? "");
  const [pickingApprover, setPickingApprover] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const assigneeBtnRef = useRef<HTMLButtonElement>(null);
  const approverBtnRef = useRef<HTMLButtonElement>(null);
  const justSavedRef = useRef(false);

  useEffect(() => setTitleDraft(task.title), [task.title]);
  useEffect(() => setNotesDraft(task.notes ?? ""), [task.notes]);
  useEffect(() => setUrlDraft(task.url ?? ""), [task.url]);

  // After an inline edit, the parent re-fetches and may re-sort the row to a
  // new position. Pull the row back into view so it doesn't get lost.
  useEffect(() => {
    if (!justSavedRef.current) return;
    justSavedRef.current = false;
    const id = requestAnimationFrame(() => {
      rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [
    task.title,
    task.notes,
    task.due_date,
    task.status,
    task.assignee_id,
    task.priority_rank,
    task.url,
    task.sent_for_approval,
    task.approver_id,
    task.approved,
  ]);

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
    justSavedRef.current = true;
    startTransition(() => updateTask(task.id, { title: next }));
  }

  function saveNotes() {
    setEditingNotes(false);
    if (notesDraft === (task.notes ?? "")) return;
    justSavedRef.current = true;
    startTransition(() => updateTask(task.id, { notes: notesDraft }));
  }

  function saveDate(value: string) {
    setEditingDate(false);
    if (value === (task.due_date ?? "")) return;
    justSavedRef.current = true;
    startTransition(() => updateTask(task.id, { due_date: value }));
  }

  function reassign(assigneeId: string | null) {
    setReassigning(false);
    if (assigneeId === task.assignee_id) return;
    justSavedRef.current = true;
    startTransition(() => updateTask(task.id, { assignee_id: assigneeId }));
  }

  function saveUrl() {
    const next = urlDraft.trim();
    setEditingUrl(false);
    if (next === (task.url ?? "")) return;
    justSavedRef.current = true;
    startTransition(() => updateTask(task.id, { url: next || null }));
  }

  function setApprover(approverId: string | null) {
    setPickingApprover(false);
    if (approverId === task.approver_id && task.sent_for_approval) return;
    justSavedRef.current = true;
    // When sending for approval, also reassign the task to the approver so
    // it shows up in their task list. When clearing the approver, leave the
    // current assignee alone (it may have been a previous handoff).
    startTransition(() =>
      updateTask(task.id, {
        approver_id: approverId,
        sent_for_approval: approverId !== null,
        ...(approverId !== null ? { assignee_id: approverId } : {}),
      })
    );
  }

  function clearApproval() {
    if (!task.sent_for_approval && !task.approved && !task.approver_id) return;
    justSavedRef.current = true;
    startTransition(() =>
      updateTask(task.id, {
        sent_for_approval: false,
        approver_id: null,
        approved: false,
      })
    );
  }

  function toggleApproved() {
    justSavedRef.current = true;
    startTransition(() =>
      updateTask(task.id, { approved: !task.approved })
    );
  }

  return (
    <div
      ref={rowRef}
      className={`grid grid-cols-1 md:grid-cols-16 gap-3 px-5 py-3 group items-start ${
        selected ? "bg-slate-100" : "hover:bg-slate-50"
      }`}
    >
      <div className="md:col-span-2 flex items-center gap-2 min-w-0 pt-1">
        {onToggleSelected && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelected}
            onClick={(e) => e.stopPropagation()}
            className="rounded cursor-pointer flex-shrink-0"
            aria-label="Select task"
          />
        )}
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
        <div className="flex items-center gap-1.5 min-w-0">
          <PriorityStar task={task} />
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
              className="flex-1 min-w-0 text-sm font-medium leading-tight border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-900"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-left text-sm font-medium leading-tight hover:bg-slate-100 rounded px-1.5 py-0.5 -mx-1.5 flex-1 min-w-0 truncate"
            >
              {task.title}
            </button>
          )}
        </div>
        {job && <p className="text-xs text-slate-500 mt-0.5 px-1.5">{job.name}</p>}
      </div>

      <div className="md:col-span-2 min-w-0 pt-1">
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

      <div className="md:col-span-1 pt-1 min-w-0">
        {editingUrl ? (
          <input
            autoFocus
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onBlur={saveUrl}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveUrl();
              if (e.key === "Escape") {
                setUrlDraft(task.url ?? "");
                setEditingUrl(false);
              }
            }}
            placeholder="https://…"
            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-900"
          />
        ) : task.url ? (
          <div className="flex items-center gap-1 group/url">
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-700 hover:text-slate-900 hover:underline flex items-center gap-1 truncate"
              title={task.url}
            >
              <LinkIcon className="w-3 h-3 flex-shrink-0 text-slate-400" />
              <span className="truncate">{prettyUrl(task.url)}</span>
            </a>
            <button
              onClick={() => setEditingUrl(true)}
              className="opacity-0 group-hover/url:opacity-100 text-[10px] text-slate-400 hover:text-slate-700 px-1"
              aria-label="Edit URL"
            >
              edit
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingUrl(true)}
            className="text-xs text-slate-400 hover:text-slate-700 px-1.5 -mx-1.5"
          >
            + link
          </button>
        )}
      </div>

      <div className="md:col-span-1 pt-1 min-w-0">
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
            className={`text-sm flex items-center gap-1 hover:bg-slate-100 rounded px-1.5 py-0.5 -mx-1.5 truncate ${
              overdue ? "text-rose-600 font-medium" : "text-slate-600"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{formatDate(task.due_date)}</span>
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

      <div className="md:col-span-2 pt-1 min-w-0">
        <button
          ref={assigneeBtnRef}
          onClick={() => setReassigning((v) => !v)}
          className={`text-sm flex items-center gap-1.5 hover:bg-slate-100 rounded px-1.5 py-0.5 -mx-1.5 w-full text-left min-w-0 ${
            task.assignee_id ? "text-slate-700" : "text-slate-400"
          }`}
          title="Click to reassign"
        >
          {(() => {
            const a = task.assignee_id
              ? profiles.find((p) => p.id === task.assignee_id) ?? null
              : null;
            return a ? (
              <Avatar name={a.name} url={a.avatar_url} size="sm" />
            ) : (
              <UserCog className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            );
          })()}
          <span className="truncate">
            {task.assignee_id
              ? profiles.find((p) => p.id === task.assignee_id)?.name ?? "Unknown"
              : "Unassigned"}
          </span>
        </button>
        {reassigning && (
          <ReassignPopover
            triggerRef={assigneeBtnRef}
            currentId={task.assignee_id}
            profiles={profiles}
            onPick={reassign}
            onClose={() => setReassigning(false)}
          />
        )}
      </div>

      <div className="md:col-span-2 pt-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <button
            ref={approverBtnRef}
            onClick={() =>
              task.sent_for_approval
                ? clearApproval()
                : setPickingApprover((v) => !v)
            }
            className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${
              task.sent_for_approval
                ? "bg-amber-500 border-amber-500 text-white"
                : "border-slate-300 hover:border-slate-500 bg-white"
            }`}
            title={
              task.sent_for_approval
                ? "Sent — click to undo"
                : "Send for approval"
            }
            aria-label="Send for approval"
          >
            {task.sent_for_approval && <Check className="w-3 h-3" strokeWidth={3} />}
          </button>
          <button
            onClick={toggleApproved}
            disabled={!task.sent_for_approval}
            className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${
              task.approved
                ? "bg-emerald-500 border-emerald-500 text-white"
                : task.sent_for_approval
                ? "border-slate-300 hover:border-emerald-500 bg-white"
                : "border-slate-200 bg-slate-50 cursor-not-allowed"
            }`}
            title={
              !task.sent_for_approval
                ? "Send for approval first"
                : task.approved
                ? "Approved — click to unapprove"
                : "Mark as approved"
            }
            aria-label="Approved"
          >
            {task.approved && <Check className="w-3 h-3" strokeWidth={3} />}
          </button>
          {task.sent_for_approval && task.approver_id && (
            <span
              className="text-[10px] text-slate-500 truncate"
              title={`To ${
                profiles.find((p) => p.id === task.approver_id)?.name ?? "—"
              }`}
            >
              →{" "}
              {profiles.find((p) => p.id === task.approver_id)?.name ?? "—"}
            </span>
          )}
        </div>
        {pickingApprover && (
          <ReassignPopover
            triggerRef={approverBtnRef}
            currentId={task.approver_id}
            profiles={profiles}
            onPick={setApprover}
            onClose={() => setPickingApprover(false)}
          />
        )}
      </div>

      <div className="md:col-span-2 flex items-center gap-1 pt-0.5">
        <select
          value={task.status}
          onChange={(e) => {
            justSavedRef.current = true;
            startTransition(() =>
              updateTaskStatus(task.id, e.target.value as TaskStatusId)
            );
          }}
          className={`text-xs font-medium border rounded-md px-2 py-1 flex-1 min-w-0 ${status.color}`}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            if (confirm("Delete this task?"))
              startTransition(() => deleteTask(task.id));
          }}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1"
          aria-label="Delete task"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
