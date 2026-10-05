"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Pencil, Plus, Send, Trash2 } from "lucide-react";
import type { Client, Meeting, Profile, ProjectBrief, Task } from "@/lib/types";
import { PHASES, type PhaseId } from "@/lib/flow";
import { TASK_STATUSES } from "@/lib/constants";
import { deleteBrief, sendBriefAsTask, updateBrief } from "@/app/actions/briefs";
import { useToast } from "./ui";
import Markdown from "./markdown";

const field = "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5 text-sm";
const label = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5";
const btn = "text-xs font-medium border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5";
const btnPrimary = "text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50 inline-flex items-center gap-1.5";
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "");

type Form = { title: string; instructions: string; useDiscovery: boolean; meetingIds: string[]; links: string; pasted: string; focus: string };

/** What the brief builds on: the client's package and the proposal's Section Three. */
export type BriefScope = { packageName: string; proposal: { phases: { title: string; package?: string }[]; sentAt: string | null } | null };

// Read the generate route's progress stream until it reports done or error.
async function runBrief(payload: Record<string, unknown>, onProgress: (chars: number) => void) {
  const res = await fetch("/api/briefs/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Couldn't start the brief (${res.status}).`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const e of events) {
      const line = e.replace(/^data: /, "").trim();
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.type === "progress") onProgress(msg.chars);
      if (msg.type === "error") throw new Error(msg.error);
      if (msg.type === "done") {
        await reader.cancel();
        return msg.id as string;
      }
    }
  }
  throw new Error("The connection closed before the brief finished. Refresh to check whether it saved.");
}

export default function ProjectBriefs({
  client,
  briefs,
  meetings,
  profiles,
  briefTasks,
  discoveryWords,
  hasFlow,
  scope,
}: {
  client: Client;
  briefs: ProjectBrief[];
  meetings: Meeting[];
  profiles: Profile[];
  briefTasks: Task[];
  discoveryWords: number;
  hasFlow: boolean;
  scope: BriefScope;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const open = briefs.find((b) => b.id === openId) ?? null;
  const name = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? "";

  if (creating) {
    return (
      <BriefForm
        client={client}
        meetings={meetings}
        discoveryWords={discoveryWords}
        scope={scope}
        onDone={(id) => { setCreating(false); setOpenId(id); }}
        onCancel={() => setCreating(false)}
      />
    );
  }
  if (open) {
    return (
      <BriefView
        brief={open}
        profiles={profiles}
        tasks={briefTasks.filter((t) => t.brief_id === open.id)}
        hasFlow={hasFlow}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          One-page briefs for the team, written from {client.name.split(" ")[0]}&apos;s call notes. Edit them, then send them to whoever&apos;s doing the work.
        </p>
        <button className={btnPrimary} onClick={() => setCreating(true)}>
          <Plus className="w-3.5 h-3.5" /> New project brief
        </button>
      </div>
      {briefs.length ? (
        <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
          {briefs.map((b) => {
            const sent = briefTasks.filter((t) => t.brief_id === b.id);
            return (
              <li key={b.id}>
                <button onClick={() => setOpenId(b.id)} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-start gap-3">
                  <FileText className="w-4 h-4 mt-0.5 text-purple-600 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{b.title}</span>
                    <span className="block text-xs text-slate-400">
                      {day(b.updated_at)}
                      {b.created_by ? ` · by ${name(b.created_by)}` : ""}
                      {b.sources.length ? ` · from ${b.sources.join(", ")}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {sent.length ? (
                      sent.map((t) => (
                        <span key={t.id} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {name(t.assignee_id) || "Unassigned"} · {TASK_STATUSES.find((s) => s.id === t.status)?.label}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400">Not sent yet</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg px-4 py-5">
          No project briefs yet. Click New project brief, pick the notes it should be based on, and the AI writes a one-page brief with the deliverables and instructions.
        </p>
      )}
    </div>
  );
}

function BriefForm({
  client,
  meetings,
  discoveryWords,
  scope,
  onDone,
  onCancel,
}: {
  client: Client;
  meetings: Meeting[];
  discoveryWords: number;
  scope: BriefScope;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<Form>({ title: "", instructions: "", useDiscovery: discoveryWords > 0, meetingIds: [], links: "", pasted: "", focus: "" });
  const [busy, setBusy] = useState(false);
  const [chars, setChars] = useState(0);
  const [error, setError] = useState("");
  const sorted = [...meetings].sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""));

  async function generate() {
    setBusy(true);
    setError("");
    setChars(0);
    try {
      const id = await runBrief(
        {
          clientId: client.id,
          title: f.title,
          instructions: f.instructions,
          useDiscovery: f.useDiscovery,
          meetingIds: f.meetingIds,
          links: f.links.split(/\s+/).filter((l) => /^https?:\/\//i.test(l)),
          pasted: f.pasted,
          focus: f.focus || null,
        },
        setChars
      );
      toast("Brief written. Check it, edit anything, then send it.");
      router.refresh();
      onDone(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't write the brief.");
    } finally {
      setBusy(false);
    }
  }

  const toggleMeeting = (id: string, on: boolean) =>
    setF((x) => ({ ...x, meetingIds: on ? [...x.meetingIds, id] : x.meetingIds.filter((m) => m !== id) }));

  return (
    <div className="flex flex-col gap-4">
      <button className={`${btn} self-start`} onClick={onCancel} disabled={busy}>
        <ArrowLeft className="w-3.5 h-3.5" /> All briefs
      </button>
      <div>
        <label className={label} htmlFor="b-title">What&apos;s the project?</label>
        <input id="b-title" className={field} value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} placeholder="e.g. Sales page build, October content shoot, Meta ads launch" />
      </div>

      <div className={`text-xs rounded-md px-3 py-2 ${scope.proposal ? "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300" : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"}`}>
        {scope.proposal ? (
          <>
            Builds on <b>{scope.packageName}</b> and the proposal{scope.proposal.sentAt ? ` sent ${day(scope.proposal.sentAt)}` : " (not sent yet)"}: what they&apos;re paying for and what we promised to create, made specific with the notes below.
          </>
        ) : (
          <>No proposal for {client.name.split(" ")[0]} yet, so the brief can only use the package ({scope.packageName}) and the notes below. Write the proposal first for a sharper brief.</>
        )}
      </div>

      {scope.proposal && scope.proposal.phases.length > 1 && (
        <div>
          <label className={label} htmlFor="b-focus">Which part of the proposal?</label>
          <select id="b-focus" className={field} value={f.focus} onChange={(e) => setF((x) => ({ ...x, focus: e.target.value }))}>
            <option value="">All of it</option>
            {scope.proposal.phases.map((p) => (
              <option key={p.title} value={p.title}>
                {p.title}
                {p.package ? ` (${p.package})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <p className={label}>Client notes to use</p>
        <div className="flex flex-col gap-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={f.useDiscovery} disabled={!discoveryWords} onChange={(e) => setF((x) => ({ ...x, useDiscovery: e.target.checked }))} />
            Discovery call notes <span className="text-xs text-slate-400">{discoveryWords ? `${discoveryWords} words` : "none yet"}</span>
          </label>
          {sorted.map((m) => (
            <label key={m.id} className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={f.meetingIds.includes(m.id)} onChange={(e) => toggleMeeting(m.id, e.target.checked)} />
              <span className="truncate">{m.title}</span>
              <span className="text-xs text-slate-400 whitespace-nowrap">{day(m.starts_at)}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={label} htmlFor="b-links">Links to notes (optional, one per line)</label>
        <textarea
          id="b-links"
          className={`${field} min-h-[60px]`}
          value={f.links}
          onChange={(e) => setF((x) => ({ ...x, links: e.target.value }))}
          placeholder={"Gemini notes, a Google Doc or any web page\nGoogle Docs must be shared as “Anyone with the link”, unless they're Gemini notes the Tracker already has"}
        />
      </div>
      <div>
        <label className={label} htmlFor="b-paste">Paste notes (optional)</label>
        <textarea id="b-paste" className={`${field} min-h-[80px]`} value={f.pasted} onChange={(e) => setF((x) => ({ ...x, pasted: e.target.value }))} placeholder="WhatsApp messages, voice-note transcript, your own notes…" />
      </div>
      <div>
        <label className={label} htmlFor="b-instr">Anything the brief must cover? (optional)</label>
        <textarea id="b-instr" className={`${field} min-h-[50px]`} value={f.instructions} onChange={(e) => setF((x) => ({ ...x, instructions: e.target.value }))} placeholder="e.g. Brief Xoli for the shoot only; the edit gets its own brief" />
      </div>

      {busy ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Writing the brief… {chars > 0 ? `${Math.round(chars / 6)} words so far` : "reading the notes"}. About a minute.
        </p>
      ) : (
        <div className="flex gap-2">
          <button className={btnPrimary} disabled={!f.title.trim()} onClick={generate}>Write the brief</button>
          <button className={btn} onClick={onCancel}>Cancel</button>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function BriefView({
  brief,
  profiles,
  tasks,
  hasFlow,
  onBack,
}: {
  brief: ProjectBrief;
  profiles: Profile[];
  tasks: Task[];
  hasFlow: boolean;
  onBack: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(brief.title);
  const [draft, setDraft] = useState(brief.content);
  const [sendOpen, setSendOpen] = useState(false);
  const [to, setTo] = useState({ assigneeId: "", dueDate: "", phase: "" });
  const name = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? "";

  // Keep the editor in step if the brief changes underneath (e.g. someone else saved it).
  const [from, setFrom] = useState(brief.updated_at);
  if (brief.updated_at !== from) {
    setFrom(brief.updated_at);
    setTitle(brief.title);
    setDraft(brief.content);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={onBack}>
          <ArrowLeft className="w-3.5 h-3.5" /> All briefs
        </button>
        <span className="text-xs text-slate-400">
          Updated {day(brief.updated_at)}
          {brief.updated_by ? ` by ${name(brief.updated_by)}` : ""}
          {brief.sources.length ? ` · from ${brief.sources.join(", ")}` : ""}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {!editing && (
            <>
              <button className={btnPrimary} onClick={() => setSendOpen((o) => !o)} aria-expanded={sendOpen}>
                <Send className="w-3.5 h-3.5" /> Send to a team member
              </button>
              <button className={btn} onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                className={`${btn} hover:text-rose-600`}
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`Delete “${brief.title}”? Tasks already sent from it stay, without the brief.`)) return;
                  start(async () => {
                    await deleteBrief(brief.id);
                    toast("Brief deleted");
                    onBack();
                  });
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {sendOpen && !editing && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-lg border border-purple-200 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/5 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!to.assigneeId) return;
            start(async () => {
              try {
                await sendBriefAsTask(brief.id, { assigneeId: to.assigneeId, dueDate: to.dueDate || null, phase: (to.phase || null) as PhaseId | null });
                toast(`Sent to ${name(to.assigneeId)} as a task, with the brief attached`);
                setSendOpen(false);
                setTo({ assigneeId: "", dueDate: "", phase: "" });
              } catch (err) {
                toast(err instanceof Error ? err.message : "Couldn't send.");
              }
            });
          }}
        >
          <label className="text-xs flex flex-col gap-1">
            <span className="font-medium text-slate-500">Who&apos;s doing it?</span>
            <select required className={field} value={to.assigneeId} onChange={(e) => setTo((x) => ({ ...x, assigneeId: e.target.value }))}>
              <option value="">Pick a team member…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs flex flex-col gap-1">
            <span className="font-medium text-slate-500">Due</span>
            <input type="date" className={field} value={to.dueDate} onChange={(e) => setTo((x) => ({ ...x, dueDate: e.target.value }))} />
          </label>
          {hasFlow && (
            <label className="text-xs flex flex-col gap-1">
              <span className="font-medium text-slate-500">Phase</span>
              <select className={field} value={to.phase} onChange={(e) => setTo((x) => ({ ...x, phase: e.target.value }))}>
                <option value="">Where they are now</option>
                {PHASES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </label>
          )}
          <button className={btnPrimary} disabled={pending || !to.assigneeId}>Send task</button>
        </form>
      )}

      {editing ? (
        <div className="flex flex-col gap-2">
          <input className={`${field} font-semibold`} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Brief name" />
          <textarea className={`${field} min-h-[460px] font-mono text-xs leading-relaxed`} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit brief" />
          <div className="flex gap-2">
            <button
              className={btnPrimary}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    await updateBrief(brief.id, { title, content: draft });
                    setEditing(false);
                    toast("Brief saved");
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Couldn't save.");
                  }
                })
              }
            >
              Save
            </button>
            <button className={btn} onClick={() => { setEditing(false); setTitle(brief.title); setDraft(brief.content); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-5 py-4">
          <Markdown text={brief.content} />
        </div>
      )}

      {tasks.length > 0 && (
        <div>
          <p className={label}>Sent as tasks</p>
          <ul className="flex flex-col gap-1 text-sm">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{name(t.assignee_id) || "Unassigned"}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{TASK_STATUSES.find((s) => s.id === t.status)?.label}</span>
                {t.due_date && <span className="text-xs text-slate-400">due {day(t.due_date)}</span>}
                {t.phase && <span className="text-xs text-slate-400">· {PHASES.find((p) => p.id === t.phase)?.label}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
