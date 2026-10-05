"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ExternalLink, FileText, History, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { Client, ClientDocument, Meeting, Profile, ProjectBrief, Task } from "@/lib/types";
import { addMeeting, deleteMeeting, saveDocEdit, updateMeeting } from "@/app/actions/client-intel";
import { useToast } from "./ui";
import Markdown from "./markdown";
import ProjectBriefs from "./project-briefs";

type Kind = "profile" | "strategy";
type Tab = Kind | "briefs";
const TITLES: Record<Kind, string> = { profile: "Client Profile", strategy: "Strategy Brief" };
const field = "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5 text-sm";
const btn = "text-xs font-medium border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5";
const when = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export default function ClientIntel({
  client,
  meetings,
  docs,
  profiles,
  briefs,
  briefTasks,
  discoveryWords,
  hasFlow,
}: {
  client: Client;
  meetings: Meeting[];
  docs: ClientDocument[];
  profiles: Profile[];
  briefs: ProjectBrief[];
  briefTasks: Task[];
  discoveryWords: number;
  hasFlow: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("strategy");
  const kind: Kind = tab === "briefs" ? "strategy" : tab;
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const versions = docs.filter((d) => d.kind === kind);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const doc = versions.find((v) => v.id === pickedId) ?? versions[0] ?? null;
  const isLatest = doc && doc.id === versions[0]?.id;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [, start] = useTransition();
  const author = (id: string | null) => (id ? profiles.find((p) => p.id === id)?.name ?? "the team" : "AI");
  const docUrl = kind === "profile" ? client.client_profile_doc_url : client.strategy_brief_doc_url;

  async function updateNow() {
    setUpdating(true);
    setError("");
    try {
      const res = await fetch(`/api/client-docs/${client.id}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast("Client Profile and Strategy Brief updated");
      setPickedId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800">
          <div role="tablist" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
            {(["strategy", "profile", "briefs"] as Tab[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => { setTab(k); setPickedId(null); setEditing(false); }}
                className={`text-xs font-medium px-3 py-1 rounded-md ${tab === k ? "bg-white dark:bg-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                {k === "briefs" ? (
                  <>
                    Project Briefs{briefs.length ? <span className="ml-1 text-slate-400 tabular-nums">{briefs.length}</span> : null}
                  </>
                ) : (
                  TITLES[k]
                )}
              </button>
            ))}
          </div>
          {tab !== "briefs" && (
          <div className="flex flex-wrap items-center gap-2">
            {client.docs_dirty_at && !updating && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                New meeting notes · update queued
              </span>
            )}
            {docUrl && (
              <a href={docUrl} target="_blank" rel="noopener noreferrer" className={btn}>
                <ExternalLink className="w-3.5 h-3.5" /> Google Doc
              </a>
            )}
            <button className={btn} disabled={updating} onClick={updateNow}>
              <RefreshCw className={`w-3.5 h-3.5 ${updating ? "animate-spin" : ""}`} />
              {updating ? "Updating… about a minute" : doc ? "Update now" : "Write them now"}
            </button>
          </div>
          )}
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {tab === "briefs" ? (
            <ProjectBriefs
              client={client}
              briefs={briefs}
              meetings={meetings}
              profiles={profiles}
              briefTasks={briefTasks}
              discoveryWords={discoveryWords}
              hasFlow={hasFlow}
            />
          ) : doc ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <FileText className="w-3.5 h-3.5" />
                <span>
                  {isLatest ? "Latest" : "Older version"} · {when(doc.created_at)} · {doc.created_by ? `edited by ${author(doc.created_by)}` : `written by AI from ${doc.sources}`}
                </span>
                {versions.length > 1 && (
                  <label className="inline-flex items-center gap-1 ml-auto">
                    <History className="w-3.5 h-3.5" />
                    <select
                      aria-label="Version"
                      value={doc.id}
                      onChange={(e) => { setPickedId(e.target.value); setEditing(false); }}
                      className="text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded px-1.5 py-0.5"
                    >
                      {versions.map((v, i) => (
                        <option key={v.id} value={v.id}>
                          {i === 0 ? "Latest · " : ""}
                          {when(v.created_at)} · {v.created_by ? author(v.created_by) : "AI"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {editing ? (
                <div className="flex flex-col gap-2">
                  <textarea className={`${field} min-h-[420px] font-mono text-xs leading-relaxed`} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`Edit ${TITLES[kind]}`} />
                  <div className="flex gap-2">
                    <button
                      className="text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md"
                      onClick={() =>
                        start(async () => {
                          await saveDocEdit(client.id, kind, draft);
                          setEditing(false);
                          setPickedId(null);
                          toast(`${TITLES[kind]} saved`);
                        })
                      }
                    >
                      Save as new version
                    </button>
                    <button className={btn} onClick={() => setEditing(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`relative ${expanded ? "" : "max-h-80 overflow-hidden"}`}>
                    <Markdown text={doc.content} />
                    {!expanded && <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-slate-900" />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className={btn} onClick={() => setExpanded((v) => !v)}>{expanded ? "Show less" : "Show all"}</button>
                    {isLatest && (
                      <button className={btn} onClick={() => { setDraft(doc.content); setEditing(true); setExpanded(true); }}>
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              No {TITLES[kind]} yet. It&apos;s written by AI from {client.name}&apos;s meeting notes, the work log, the discovery notes, the Yellow Sheet and the proposal,
              and it updates whenever new meeting notes come in.
            </p>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </section>

      <Meetings client={client} meetings={meetings} author={author} />
    </div>
  );
}

function Meetings({ client, meetings, author }: { client: Client; meetings: Meeting[]; author: (id: string | null) => string }) {
  const toast = useToast();
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", date: "", notes: "" });
  const [error, setError] = useState("");
  const sorted = [...meetings].sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""));

  const submit = () =>
    start(async () => {
      setError("");
      try {
        const input = { title: form.title, starts_at: form.date ? new Date(form.date).toISOString() : null, notes: form.notes };
        if (editId) await updateMeeting(editId, input);
        else await addMeeting(client.id, input);
        toast(editId ? "Notes updated" : "Meeting notes added · documents will update shortly");
        setAdding(false);
        setEditId(null);
        setForm({ title: "", date: "", notes: "" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="font-semibold text-sm">Meeting notes <span className="text-slate-400 font-normal tabular-nums">{meetings.length}</span></h3>
        {!adding && (
          <button className={btn} onClick={() => { setAdding(true); setEditId(null); setForm({ title: "", date: new Date().toISOString().slice(0, 16), notes: "" }); }}>
            <Plus className="w-3.5 h-3.5" /> Add meeting notes
          </button>
        )}
      </div>
      {adding && (
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2.5 bg-slate-50 dark:bg-slate-800/40">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_200px] gap-2">
            <input className={field} placeholder="Meeting title, e.g. Monthly check-in" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} aria-label="Meeting title" />
            <input className={field} type="datetime-local" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} aria-label="Meeting date" />
          </div>
          <textarea className={`${field} min-h-[140px]`} placeholder="Paste the notes or transcript" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} aria-label="Meeting notes" />
          <div className="flex gap-2">
            <button className="text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50" disabled={!form.notes.trim()} onClick={submit}>
              {editId ? "Save notes" : "Add notes"}
            </button>
            <button className={btn} onClick={() => { setAdding(false); setEditId(null); }}>Cancel</button>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      )}
      {sorted.length ? (
        sorted.map((m) => {
          const open = openId === m.id;
          return (
            <div key={m.id} className="px-5 py-3 border-b last:border-0 border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                <button className="text-sm font-medium text-left hover:underline" onClick={() => setOpenId(open ? null : m.id)}>
                  {m.title || "Meeting"}
                </button>
                <span className="text-xs text-slate-400">{when(m.starts_at)}</span>
                <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {m.source === "calendar" ? "Calendar" : `Added by ${author(m.created_by)}`}
                </span>
                {m.notes_url && (
                  <a href={m.notes_url} target="_blank" rel="noopener noreferrer" className="text-xs underline">Notes by Gemini</a>
                )}
                {m.source === "manual" && (
                  <span className="ml-auto flex gap-1">
                    <button
                      aria-label="Edit notes"
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                      onClick={() => { setEditId(m.id); setAdding(true); setForm({ title: m.title, date: m.starts_at ? m.starts_at.slice(0, 16) : "", notes: m.notes }); }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      aria-label="Delete notes"
                      className="text-slate-400 hover:text-rose-600 p-1"
                      onClick={() => start(async () => { await deleteMeeting(m.id); toast("Notes deleted"); })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>
              {m.notes.trim() && (
                <p className={`mt-1.5 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap ${open ? "" : "line-clamp-2"}`}>{m.notes}</p>
              )}
            </div>
          );
        })
      ) : (
        <p className="px-5 py-5 text-sm text-slate-400">
          No meetings yet. Meetings in info@clubsheis.com&apos;s calendar with {client.name} as a guest appear here with their Gemini notes.
        </p>
      )}
    </section>
  );
}
