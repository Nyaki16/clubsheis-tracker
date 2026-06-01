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

// ── Column widths (shared singleton so every row stays in sync) ──────────
//
// Each column's width is an `fr` unit. Resize handles redistribute width
// between two adjacent cols; total fr stays constant so other cols don't
// shift.

const COL_KEYS = [
  "client",
  "task",
  "notes",
  "link",
  "due",
  "assignee",
  "approval",
  "status",
] as const;

const DEFAULT_COL_WIDTHS: number[] = [2, 3, 2, 1, 1, 2, 2, 2];
const MIN_FR = 0.5;
const STORAGE_KEY = "task-grid.widths.v1";

let _widths: number[] = [...DEFAULT_COL_WIDTHS];
let _widthsLoaded = false;
const _widthSubs = new Set<() => void>();

function loadWidthsOnce() {
  if (_widthsLoaded) return;
  _widthsLoaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length === DEFAULT_COL_WIDTHS.length &&
      parsed.every((n) => typeof n === "number" && n >= MIN_FR)
    ) {
      _widths = parsed;
    }
  } catch {}
}

function commitWidths(next: number[]) {
  _widths = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_widths));
  } catch {}
  _widthSubs.forEach((cb) => cb());
}

function useColumnWidths() {
  const [, force] = useState(0);
  useEffect(() => {
    loadWidthsOnce();
    const cb = () => force((v) => v + 1);
    _widthSubs.add(cb);
    // Re-render once after load in case localStorage had values.
    force((v) => v + 1);
    return () => {
      _widthSubs.delete(cb);
    };
  }, []);
  return {
    widths: _widths,
    gridTemplate: _widths.map((w) => `${w}fr`).join(" "),
  };
}

// Drag handle between columns `index` and `index + 1`. Pointer events; uses
// the container's bounding box to translate pixel-delta → fr-delta.
function ColResizeHandle({ index }: { index: number }) {
  return (
    <div
      onPointerDown={(e) => {
        e.preventDefault();
        const handle = e.currentTarget as HTMLDivElement;
        handle.setPointerCapture(e.pointerId);
        const header = handle.closest<HTMLElement>("[data-task-grid-row]");
        const containerWidth = header
          ? header.getBoundingClientRect().width
          : 1000;
        const startX = e.clientX;
        const start = [..._widths];
        const totalFr = start.reduce((s, v) => s + v, 0);
        const frPerPx = totalFr / Math.max(containerWidth, 1);

        function move(ev: PointerEvent) {
          const dx = ev.clientX - startX;
          const dFr = dx * frPerPx;
          const a = start[index] + dFr;
          const b = start[index + 1] - dFr;
          if (a < MIN_FR || b < MIN_FR) return;
          const next = [...start];
          next[index] = a;
          next[index + 1] = b;
          commitWidths(next);
        }
        function up() {
          handle.releasePointerCapture(e.pointerId);
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        }
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-10 group/handle"
      aria-hidden
    >
      <div className="absolute right-1.5 top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-700 group-hover/handle:bg-slate-500 transition-colors" />
    </div>
  );
}

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
  const { gridTemplate } = useColumnWidths();

  const arrow = (k: SortKey) =>
    onSort && sortKey === k ? (
      sortDir === "asc" ? (
        <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3" />
      )
    ) : null;

  const cellBtn = "flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 truncate";
  const sortable = (k: SortKey, label: string) =>
    onSort ? (
      <button onClick={() => onSort(k)} className={cellBtn}>
        {label} {arrow(k)}
      </button>
    ) : (
      <div className="truncate">{label}</div>
    );

  // Order matches COL_KEYS / DEFAULT_COL_WIDTHS.
  const cells: { content: React.ReactNode }[] = [
    { content: sortable("client", "Client") },
    { content: sortable("task", "Task") },
    { content: <div className="truncate">Notes</div> },
    { content: <div className="truncate">Link</div> },
    { content: sortable("due", "Due") },
    { content: <div className="truncate">Assignee</div> },
    { content: <div className="truncate">Approval</div> },
    { content: sortable("status", "Status") },
  ];

  return (
    <div
      data-task-grid-row
      style={{ gridTemplateColumns: gridTemplate }}
      className="hidden md:grid gap-3 px-5 py-2 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium bg-slate-50 dark:bg-slate-800/40/50"
    >
      {cells.map((c, i) => (
        <div key={COL_KEYS[i]} className="relative min-w-0">
          {c.content}
          {i < cells.length - 1 && <ColResizeHandle index={i} />}
        </div>
      ))}
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
          : "text-slate-300 dark:text-slate-600 hover:text-amber-500 opacity-0 group-hover:opacity-100 focus:opacity-100"
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
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1"
    >
      <button
        onClick={() => onPick(null)}
        className={`w-full text-left text-xs px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 ${
          currentId === null ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"
        }`}
      >
        Unassigned
      </button>
      {profiles.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p.id)}
          className={`w-full text-left text-xs px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 ${
            currentId === p.id ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"
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
  const { gridTemplate } = useColumnWidths();
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
    // When sending for approval: stash the current assignee as the
    // originator so we know who to hand the task back to once approved.
    // Then reassign to the approver so it lands in their task list.
    // When clearing: leave the originator/assignee alone — undoing only
    // resets the approval flags, not who the task belongs to.
    if (approverId !== null) {
      startTransition(() =>
        updateTask(task.id, {
          approver_id: approverId,
          sent_for_approval: true,
          assignee_id: approverId,
          originator_id: task.originator_id ?? task.assignee_id ?? null,
        })
      );
    } else {
      startTransition(() =>
        updateTask(task.id, {
          approver_id: null,
          sent_for_approval: false,
        })
      );
    }
  }

  function clearApproval() {
    if (!task.sent_for_approval && !task.approved && !task.approver_id) return;
    justSavedRef.current = true;
    // Undo of the send: hand the task back to whoever originated it, then
    // wipe the approval state.
    startTransition(() =>
      updateTask(task.id, {
        sent_for_approval: false,
        approver_id: null,
        approved: false,
        ...(task.originator_id ? { assignee_id: task.originator_id } : {}),
        originator_id: null,
      })
    );
  }

  function toggleApproved() {
    justSavedRef.current = true;
    const nextApproved = !task.approved;
    // When approving for the first time, hand the task back to whoever
    // originally sent it for review. Clear the originator afterwards so a
    // second round-trip would re-capture the new sender.
    if (nextApproved && task.originator_id) {
      startTransition(() =>
        updateTask(task.id, {
          approved: true,
          assignee_id: task.originator_id,
          originator_id: null,
        })
      );
    } else {
      startTransition(() => updateTask(task.id, { approved: nextApproved }));
    }
  }

  return (
    <div
      ref={rowRef}
      data-task-grid-row
      style={
        {
          // Desktop applies the resizable template via CSS var. Mobile falls
          // back to a single-column stack from the Tailwind classes below.
          ["--cols" as string]: gridTemplate,
        } as React.CSSProperties
      }
      className={`grid grid-cols-1 md:[grid-template-columns:var(--cols)] gap-3 px-5 py-3 group items-start ${
        selected ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 pt-1">
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
        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
          {client?.name ?? "—"}
        </span>
      </div>

      <div className="min-w-0">
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
              className="flex-1 min-w-0 text-sm font-medium leading-tight border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-left text-sm font-medium leading-tight hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-1.5 py-0.5 -mx-1.5 flex-1 min-w-0 truncate"
            >
              {task.title}
            </button>
          )}
        </div>
        {job && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 px-1.5">{job.name}</p>}
      </div>

      <div className="min-w-0 pt-1">
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
            className="w-full text-xs text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 resize-y"
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
            className="flex items-start gap-1 text-left text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-1.5 py-0.5 -mx-1.5 w-full"
            title={notesExpanded ? "Click to edit" : "Click to expand"}
          >
            {notesExpanded ? (
              <ChevronDown className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
            ) : (
              <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
            )}
            <span className={notesExpanded ? "whitespace-pre-wrap" : "truncate"}>
              {task.notes}
            </span>
          </button>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 px-1.5 -mx-1.5"
          >
            + add note
          </button>
        )}
      </div>

      <div className="pt-1 min-w-0">
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
            className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300"
          />
        ) : task.url ? (
          <div className="flex items-center gap-1 group/url">
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:underline flex items-center gap-1 truncate"
              title={task.url}
            >
              <LinkIcon className="w-3 h-3 flex-shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="truncate">{prettyUrl(task.url)}</span>
            </a>
            <button
              onClick={() => setEditingUrl(true)}
              className="opacity-0 group-hover/url:opacity-100 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 px-1"
              aria-label="Edit URL"
            >
              edit
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingUrl(true)}
            className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 px-1.5 -mx-1.5"
          >
            + link
          </button>
        )}
      </div>

      <div className="pt-1 min-w-0">
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
            className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300"
          />
        ) : task.due_date ? (
          <button
            onClick={() => setEditingDate(true)}
            className={`text-sm flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-1.5 py-0.5 -mx-1.5 truncate ${
              overdue ? "text-rose-600 font-medium" : "text-slate-600 dark:text-slate-300"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{formatDate(task.due_date)}</span>
          </button>
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 px-1.5 -mx-1.5"
          >
            + set date
          </button>
        )}
      </div>

      <div className="pt-1 min-w-0">
        <button
          ref={assigneeBtnRef}
          onClick={() => setReassigning((v) => !v)}
          className={`text-sm flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-1.5 py-0.5 -mx-1.5 w-full text-left min-w-0 ${
            task.assignee_id ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"
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
              <UserCog className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
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

      <div className="pt-1 min-w-0">
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
                : "border-slate-300 dark:border-slate-700 hover:border-slate-500 bg-white dark:bg-slate-900"
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
                ? "border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white dark:bg-slate-900"
                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed"
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
              className="text-[10px] text-slate-500 dark:text-slate-400 truncate"
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

      <div className="flex items-center gap-1 pt-0.5">
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
          className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-rose-600 p-1"
          aria-label="Delete task"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
