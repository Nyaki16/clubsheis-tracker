"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, Trash2, X } from "lucide-react";
import type { TaskStatusId } from "@/lib/constants";
import { PHASES, TECH_CHECKS, TOOL_INPUTS, isDone, type PricingTier } from "@/lib/flow";
import type { Client, Profile, Task } from "@/lib/types";
import { deleteTask, updateTask } from "@/app/actions/tasks";
import { restoreTask, updateToolState } from "@/app/actions/flow";
import { DebbieBadge, PhaseDot, StatusSelect, useToast } from "./ui";
import ProposalTool from "./proposal-tool";
import GenTool from "./gen-tool";
import { YS_REQUIRED, YS_SECTIONS } from "@/lib/yellow-sheet";
import { CLIENT_SENDER } from "@/lib/sender";
import { getBrief } from "@/app/actions/briefs";
import { queueDocsForTask } from "@/app/actions/client-intel";
import Markdown from "./markdown";

const field = "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5 text-sm";
const label = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5";

export default function TaskDrawer({
  task,
  client,
  clientTasks,
  profiles,
  tiers,
  onClose,
  onOpenTask,
  onEditClient,
}: {
  task: Task;
  client: Client;
  clientTasks: Task[];
  profiles: Profile[];
  tiers: PricingTier[];
  onClose: () => void;
  onOpenTask?: (id: string) => void;
  onEditClient?: () => void;
}) {
  const [, startTransition] = useTransition();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [notes, setNotes] = useState(task.notes);
  const [notesFrom, setNotesFrom] = useState(task.notes);
  if (task.notes !== notesFrom) {
    setNotesFrom(task.notes);
    setNotes(task.notes);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const phase = PHASES.find((p) => p.id === task.phase);
  const save = (u: Parameters<typeof updateTask>[1]) => startTransition(() => updateTask(task.id, u));

  function remove() {
    const row = { ...task } as Record<string, unknown>;
    delete row.updated_at;
    startTransition(async () => {
      await deleteTask(task.id);
      onClose();
      toast(`Deleted "${task.title}"`, () => startTransition(() => restoreTask(row)));
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        className="w-full max-w-xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <PhaseDot phase={task.phase} />
            <Link href={`/clients/${client.id}`} className="hover:text-slate-700 dark:hover:text-slate-200">
              {client.name}
            </Link>
            <span>·</span>
            <span>{phase?.label ?? "Task"}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">{task.title}</h2>
            <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={label} htmlFor="t-status">Status</label>
              <StatusSelect id="t-status" value={task.status} onChange={(s: TaskStatusId) => save({ status: s })} />
            </div>
            <div>
              <label className={label} htmlFor="t-owner">Owner</label>
              <select id="t-owner" className={field} value={task.assignee_id ?? ""} onChange={(e) => save({ assignee_id: e.target.value || null })}>
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="t-due">Due</label>
              <input id="t-due" type="date" className={field} value={task.due_date ?? ""} onChange={(e) => save({ due_date: e.target.value || null })} />
            </div>
          </div>

          {task.debbie_recommended && (
            <div className="rounded-lg border border-purple-200 dark:border-purple-500/30 bg-purple-50/60 dark:bg-purple-500/10 px-3.5 py-2.5 text-sm flex flex-col gap-1">
              <DebbieBadge source={task.debbie_source} />
              <p className="text-slate-700 dark:text-slate-200">
                {task.debbie_source?.meeting_id ? (
                  <>
                    Debbie added this from{" "}
                    <Link className="underline" href={`/meetings/${task.debbie_source.meeting_id}`}>{task.debbie_source.meeting_title}</Link>
                    {task.debbie_source.date ? ` (${new Date(task.debbie_source.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })})` : ""}. Delete it if it isn&apos;t right.
                  </>
                ) : (
                  <>{task.debbie_source?.meeting_title ?? "Added by Debbie"}.</>
                )}
              </p>
              {task.debbie_source?.quote && <p className="text-xs italic text-slate-500">“{task.debbie_source.quote}”</p>}
            </div>
          )}

          {task.brief_id && <BriefBox key={task.brief_id} briefId={task.brief_id} />}

          <ToolPanel task={task} client={client} clientTasks={clientTasks} tiers={tiers} onOpenTask={onOpenTask} onEditClient={onEditClient} />

          <div>
            <label className={label} htmlFor="t-notes">Notes</label>
            <textarea
              id="t-notes"
              className={`${field} min-h-[80px]`}
              placeholder="Anything the team should know"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== task.notes && save({ notes })}
            />
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-3 flex items-center justify-between gap-3">
          {confirming ? (
            <>
              <span className="text-xs text-rose-600">Delete this task and anything generated in it?</span>
              <span className="flex gap-2">
                <button onClick={remove} className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-md">Delete</button>
                <button onClick={() => setConfirming(false)} className="text-xs font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md">Cancel</button>
              </span>
            </>
          ) : (
            <>
              <button onClick={() => setConfirming(true)} className="text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-2 py-1.5 rounded-md flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete task
              </button>
              {isDone(task) ? (
                <button onClick={() => save({ status: "in_progress" })} className="text-sm font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md">Reopen</button>
              ) : (
                <button onClick={() => save({ status: "closed_out" })} className="text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 rounded-md">Mark closed out</button>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Built-in tools ──────────────────────────────────────────────────────────

// The project brief this task was sent from, read fresh so edits on the client page show here.
function BriefBox({ briefId }: { briefId: string }) {
  const [brief, setBrief] = useState<Awaited<ReturnType<typeof getBrief>> | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    getBrief(briefId)
      .then((b) => alive && setBrief(b))
      .catch(() => alive && setBrief(null));
    return () => {
      alive = false;
    };
  }, [briefId]);
  return (
    <ToolBox title="Project brief">
      {brief === undefined ? (
        <p className="text-sm text-slate-400">Loading the brief…</p>
      ) : brief ? (
        <>
          <Markdown text={brief.content} />
          <Link href={`/clients/${brief.client_id}`} className="text-xs underline self-start">
            Edit it on the client&apos;s page (Project Briefs)
          </Link>
        </>
      ) : (
        <p className="text-sm text-slate-400">This brief was deleted from the client&apos;s page.</p>
      )}
    </ToolBox>
  );
}

function ToolBox({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <section className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 text-sm font-semibold">
        <Sparkles className="w-4 h-4" />
        {title}
        {right && <span className="ml-auto text-xs font-medium opacity-80">{right}</span>}
      </div>
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function useToolField(task: Task, key: string) {
  const stored = String(task.tool_state?.[key] ?? "");
  const [v, setV] = useState(stored);
  const [from, setFrom] = useState(stored);
  if (stored !== from) {
    setFrom(stored);
    setV(stored);
  }
  const [, start] = useTransition();
  const commit = () => {
    if (v !== String(task.tool_state?.[key] ?? "")) start(() => updateToolState(task.id, { [key]: v }));
  };
  return { value: v, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value), onBlur: commit };
}

// Gemini notes usually land within an hour of the call ending.
const callIsOver = (iso: string) => new Date(iso).getTime() < Date.now() - 3 * 3600e3;

function ToolPanel({
  task,
  client,
  clientTasks,
  tiers,
  onOpenTask,
  onEditClient,
}: {
  task: Task;
  client: Client;
  clientTasks: Task[];
  tiers: PricingTier[];
  onOpenTask?: (id: string) => void;
  onEditClient?: () => void;
}) {
  const [, start] = useTransition();
  const toast = useToast();
  const need = useToolField(task, "need");
  const transcript = useToolField(task, "transcript");
  const link = useToolField(task, "link");

  switch (task.tool) {
    case "discovery":
      return (
        <ToolBox title="Discovery call">
          {client.call_at && (
            <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 rounded-md px-3 py-2">
              Call on {new Date(client.call_at).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              {client.call_notes_url && (
                <>
                  {" · "}
                  <a className="underline" href={client.call_notes_url} target="_blank" rel="noopener noreferrer">Notes by Gemini</a>
                </>
              )}
            </p>
          )}
          {client.call_at && !client.call_notes_url && !String(task.tool_state?.transcript ?? "").trim() && callIsOver(client.call_at) && (
            <p className="text-xs text-amber-800 bg-amber-50 dark:text-amber-200 dark:bg-amber-500/10 rounded-md px-3 py-2">
              Gemini didn&apos;t take notes on this call, so there&apos;s nothing to pull in. Paste your notes or the transcript below. Next time, click{" "}
              <b>Take notes with Gemini</b> in Meet and they&apos;ll arrive here by themselves.
            </p>
          )}
          <div>
            <label className={label} htmlFor="d-need">What they need</label>
            <textarea id="d-need" className={`${field} min-h-[70px]`} placeholder="Goals, problems, what they asked for" {...need} />
          </div>
          <div>
            <label className={label} htmlFor="d-transcript">Call notes or transcript</label>
            <textarea id="d-transcript" className={`${field} min-h-[110px]`} placeholder="Paste the transcript or your notes" {...transcript} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="d-link">Recording / transcript link</label>
              <input id="d-link" className={field} placeholder="Drive, Fathom, Zoom…" {...link} />
            </div>
            <div>
              <label className={label} htmlFor="d-lead">Lead status</label>
              <select
                id="d-lead"
                className={field}
                value={String(task.tool_state?.lead ?? "")}
                onChange={(e) => start(() => updateToolState(task.id, { lead: e.target.value }, task.status === "planning" ? "in_progress" : undefined))}
              >
                <option value="">Choose…</option>
                <option>Good fit</option>
                <option>Not a fit</option>
                <option>Follow up</option>
              </select>
            </div>
          </div>
          <DiscoveryNext task={task} client={client} clientTasks={clientTasks} onOpenTask={onOpenTask} />
        </ToolBox>
      );

    case "checklist": {
      const checks = (task.tool_state?.checks as boolean[] | undefined) ?? TECH_CHECKS.map(() => false);
      const n = checks.filter(Boolean).length;
      return (
        <ToolBox title="Checklist" right={`${n}/${TECH_CHECKS.length}`}>
          <div className="flex flex-col">
            {TECH_CHECKS.map((c, i) => (
              <label key={c.label} className="flex gap-3 items-start py-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 accent-purple-600"
                  checked={!!checks[i]}
                  onChange={(e) => {
                    const next = TECH_CHECKS.map((_, k) => (k === i ? e.target.checked : !!checks[k]));
                    const all = next.every(Boolean);
                    const status = all ? "closed_out" : next.some(Boolean) && (task.status === "planning" || isDone(task)) ? "in_progress" : undefined;
                    start(() => updateToolState(task.id, { checks: next }, status));
                    if (all) toast(`${task.title} complete`);
                  }}
                />
                <span>
                  <span className={`block text-sm font-medium ${checks[i] ? "line-through text-slate-400" : ""}`}>{c.label}</span>
                  <span className="block text-xs text-slate-400">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </ToolBox>
      );
    }

    case "yellow":
      return (
        <ToolBox title="Yellow Sheet" right={task.tool_state?.state === "submitted" ? "Received" : "Waiting on client"}>
          <YellowSheetPanel task={task} clientTasks={clientTasks} />
        </ToolBox>
      );

    case "proposal":
      return (
        <ToolBox title="Proposal PDF + email" right="Claude · Gmail">
          <ProposalTool task={task} client={client} clientTasks={clientTasks} tiers={tiers} onEditClient={onEditClient} />
        </ToolBox>
      );

    case "account":
      return (
        <ToolBox title="Ghutte setup">
          <GhutteAccount client={client} clientTasks={clientTasks} />
        </ToolBox>
      );

    case "gen":
      return (
        <ToolBox title="AI generator" right="Claude">
          <GenTool task={task} client={client} clientTasks={clientTasks} />
        </ToolBox>
      );

    default:
      return null;
  }
}

// What happens after the call, by lead status.
function DiscoveryNext({
  task,
  client,
  clientTasks,
  onOpenTask,
}: {
  task: Task;
  client: Client;
  clientTasks: Task[];
  onOpenTask?: (id: string) => void;
}) {
  const ts = task.tool_state ?? {};
  const lead = String(ts.lead ?? "");
  const proposal = clientTasks.find((t) => t.tool === "proposal");
  const hasNotes = !!(ts.need || ts.transcript);
  const [, start] = useTransition();
  const toast = useToast();
  const first = client.name.split(" ")[0];
  const [thanks, setThanks] = useState(
    String(
      ts.thanks ??
        `Hi ${first},\n\nThank you for taking the time to chat with us. Right now we're not the best fit for what you need, and we'd rather tell you that honestly than sell you something that won't serve you. If things change, our door is always open.\n\n${CLIENT_SENDER.signOff}`
    )
  );
  const [to, setTo] = useState(client.email ?? "");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [now] = useState(() => Date.now());

  if (lead === "Good fit" && proposal) {
    const drafted = !!(proposal.tool_state as Record<string, unknown>)?.data;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {drafted && <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✓ Proposal drafted</span>}
        <button
          disabled={!hasNotes}
          onClick={() => onOpenTask?.(proposal.id)}
          className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          {drafted ? "Open proposal" : "Write the proposal from these notes"}
        </button>
        {!hasNotes && <span className="text-xs text-slate-400">Add what they need or the call notes first.</span>}
      </div>
    );
  }

  if (lead === "Follow up") {
    const when = new Date(now + 14 * 864e5);
    const day = when.toISOString().slice(0, 10).replace(/-/g, "");
    const url =
      "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      `&text=${encodeURIComponent(`Follow up: ${client.name}`)}` +
      `&dates=${day}T080000Z/${day}T083000Z` +
      `&details=${encodeURIComponent(`Follow up on the discovery call with ${client.name}${client.business_name ? ` (${client.business_name})` : ""}.`)}`;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="self-start text-sm font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800">
        Add a follow-up to Google Calendar (14 days)
      </a>
    );
  }

  if (lead === "Not a fit") {
    if (ts.thanks_sent_at) {
      return <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✓ Thank-you email sent</p>;
    }
    return (
      <div className="flex flex-col gap-2">
        <label className={label} htmlFor="d-thanks">Thank-you email</label>
        <input className={field} type="email" aria-label="Send to" placeholder="Client's email" value={to} onChange={(e) => setTo(e.target.value)} />
        <textarea id="d-thanks" className={`${field} min-h-[140px]`} value={thanks} onChange={(e) => setThanks(e.target.value)} />
        <button
          disabled={sending || !to.trim()}
          onClick={async () => {
            setSending(true);
            setErr("");
            try {
              const res = await fetch("/api/email/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to, subject: "Thank you from ClubSheIs", body: thanks }),
              });
              const j = await res.json();
              if (!res.ok) throw new Error(j.error || "Couldn't send.");
              start(() => updateToolState(task.id, { thanks, thanks_sent_at: new Date().toISOString() }, "closed_out"));
              toast("Thank-you email sent");
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Couldn't send.");
            } finally {
              setSending(false);
            }
          }}
          className="self-start text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send thank-you"}
        </button>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    );
  }

  return null;
}

const PUBLIC_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://clubsheis-tracker.vercel.app").replace(/\/$/, "");

function YsField({ task, k, labelText, placeholder, rows }: { task: Task; k: string; labelText: string; placeholder: string; rows: number }) {
  const f = useToolField(task, k);
  return (
    <div>
      <label className={label} htmlFor={`y-${k}`}>{labelText}</label>
      {rows === 1 ? (
        <input id={`y-${k}`} className={field} placeholder={placeholder} {...f} />
      ) : (
        <textarea id={`y-${k}`} className={`${field} min-h-[60px]`} rows={rows} placeholder={placeholder} {...f} />
      )}
    </div>
  );
}

function YellowSheetPanel({ task, clientTasks }: { task: Task; clientTasks: Task[] }) {
  const [, start] = useTransition();
  const toast = useToast();
  const ts = task.tool_state ?? {};
  const submitted = ts.state === "submitted";
  const link = `${PUBLIC_URL}/yellow-sheet/${task.id}`;
  const feeds = clientTasks.filter((t) => (TOOL_INPUTS[t.title] ?? []).includes("Yellow Sheet"));
  const [open, setOpen] = useState(!submitted);
  const missing = YS_REQUIRED.filter((k) => !String(ts[k] ?? "").trim());

  return (
    <>
      <p className="text-xs text-slate-500">
        Send the client this link once they&apos;ve paid for Ghutte. Their answers land here, and the team can fill in or edit anything below.
      </p>
      <div className="flex gap-2">
        <input readOnly aria-label="Yellow Sheet link" value={link} className={`${field} font-mono text-xs`} onFocus={(e) => e.target.select()} />
        <button
          className="text-sm font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md whitespace-nowrap"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              toast("Link copied");
            } catch {
              toast("Select the link and copy it");
            }
          }}
        >
          Copy link
        </button>
      </div>
      {submitted && (
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          ✓ {ts.submitted_by === "client" ? "Submitted by the client" : "Received"}
          {ts.submitted_at ? ` on ${new Date(String(ts.submitted_at)).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}` : ""}. Feeds{" "}
          {feeds.map((t) => t.title).join(", ") || "the copy tasks"}.
        </p>
      )}
      <button className="self-start text-xs font-medium underline" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide answers" : "Show answers"}
      </button>
      {open &&
        YS_SECTIONS.map((sec) => (
          <div key={sec.title} className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{sec.title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {sec.fields.map((f) => (
                <div key={f.key} className={f.half ? "" : "sm:col-span-2"}>
                  <YsField task={task} k={f.key} labelText={f.label} placeholder={f.placeholder} rows={f.rows} />
                </div>
              ))}
            </div>
          </div>
        ))}
      {!submitted && (
        <button
          disabled={missing.length > 0}
          title={missing.length ? "Fill in the business, offer and brand voice first" : undefined}
          onClick={() =>
            start(async () => {
              await updateToolState(task.id, { state: "submitted", submitted_at: new Date().toISOString(), submitted_by: "team" }, "closed_out");
              await queueDocsForTask(task.id);
              toast("Yellow Sheet received. The Client Profile updates within about 10 minutes.");
            })
          }
          className="self-start text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          Mark as received
        </button>
      )}
    </>
  );
}

function CopyRow({ label: name, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 text-xs text-slate-400">{name}</span>
      <span className="min-w-0 flex-1 truncate">{value}</span>
      <button
        type="button"
        className="text-xs underline text-slate-500 hover:text-slate-900 dark:hover:text-white"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast(`${name} copied`);
          } catch {
            toast("Select it and copy it");
          }
        }}
      >
        Copy
      </button>
    </div>
  );
}

// Done by hand in Ghutte: the client's details to copy, and what to do.
function GhutteAccount({ client, clientTasks }: { client: Client; clientTasks: Task[] }) {
  const ys = (clientTasks.find((t) => t.tool === "yellow")?.tool_state ?? {}) as Record<string, string>;
  const v = (k: string) => (typeof ys[k] === "string" ? ys[k].trim() : "");
  const first = client.name.split(" ")[0];
  const details: [string, string][] = (
    [
      ["Business name", v("business_name") || client.business_name || client.name],
      ["Client", [v("first_name"), v("last_name")].filter(Boolean).join(" ") || client.name],
      ["Email", v("email") || client.email || ""],
      ["Phone", v("phone") || client.phone || ""],
      ["Website", v("website") || client.website_url || ""],
      ["Street address", v("address")],
      ["City", v("city")],
      ["Province", v("state")],
      ["Country", v("country")],
      ["Postal code", v("postal_code")],
    ] as [string, string][]
  ).filter(([, val]) => val);

  return (
    <div className="flex flex-col gap-3">
      <ol className="list-decimal pl-5 text-sm flex flex-col gap-1 text-slate-700 dark:text-slate-300">
        <li>In Ghutte, switch to Agency View and create a sub-account with the details below. Apply the ClubSheIs snapshot.</li>
        <li>Add {first} as a user on it, with the email below.</li>
        <li>Send {first} their login, then mark this task Closed Out.</li>
      </ol>
      {!v("address") && (
        <p className="text-xs text-slate-500">The Yellow Sheet isn&apos;t in yet, so there&apos;s no address: use Johannesburg, Gauteng, 2000 for now.</p>
      )}
      <div className="flex flex-col gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
        {details.map(([k, val]) => (
          <CopyRow key={k} label={k} value={val} />
        ))}
      </div>
      <a href="https://system.ghutte.com" target="_blank" rel="noopener noreferrer" className="self-start text-xs underline">
        Open Ghutte
      </a>
    </div>
  );
}
