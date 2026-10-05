"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { TOOL_INPUTS, isDone } from "@/lib/flow";
import type { Client, Task } from "@/lib/types";
import { updateToolState } from "@/app/actions/flow";
import { useToast } from "./ui";

const field = "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5 text-sm";
const label = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5";
const btnPrimary = "text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50";
const btn = "text-sm font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";

const LINK_TASKS = new Set(["Internal check", "Hand over"]);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export default function GenTool({ task, client, clientTasks }: { task: Task; client: Client; clientTasks: Task[] }) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const ts = task.tool_state ?? {};
  const saved = str(ts.text);
  const approved = ts.state === "approved";

  const [notes, setNotes] = useState(str(ts.notes));
  const [links, setLinks] = useState(str(ts.links));
  const [text, setText] = useState(saved);
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const liveRef = useRef<HTMLPreElement>(null);
  const [textFrom, setTextFrom] = useState(saved);
  if (saved !== textFrom) {
    setTextFrom(saved);
    setText(saved);
  }
  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [live]);

  const needs = (TOOL_INPUTS[task.title] ?? ["Yellow Sheet"])
    .map((n) => ({ n, src: clientTasks.find((t) => t.title === n) }))
    .filter((x) => x.src);

  async function generate() {
    setBusy(true);
    setError("");
    setLive("");
    try {
      if (LINK_TASKS.has(task.title) && links !== str(ts.links)) await updateToolState(task.id, { links });
      const res = await fetch(`/api/generate/${task.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Couldn't start (${res.status}).`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const e of events) {
          const line = e.replace(/^data: /, "").trim();
          if (!line) continue;
          const msg = JSON.parse(line);
          if (msg.type === "delta") setLive((t) => t + msg.text);
          if (msg.type === "error") throw new Error(msg.error);
          if (msg.type === "done") {
            finished = true;
            if (msg.truncated) toast("The draft hit the length limit and may be cut off at the end");
            else toast(`${task.title} draft ready`);
          }
        }
      }
      if (finished) await reader.cancel();
      else throw new Error("The connection closed early. Refresh to check whether the draft saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function saveToDrive() {
    setSaving(true);
    setError("");
    try {
      if (text !== saved) await updateToolState(task.id, { text });
      const res = await fetch(`/api/google-doc/${task.id}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't save to Drive.");
      toast("Saved to Google Drive");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save to Drive.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {needs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-slate-500">Uses as input:</p>
          <div className="flex flex-wrap gap-1.5">
            {needs.map(({ n, src }) => {
              const ok = src && (isDone(src) || ["approved", "submitted", "draft"].includes(str(src.tool_state?.state)));
              return (
                <span
                  key={n}
                  className={`text-xs px-2 py-0.5 rounded-full ${ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "border border-dashed border-slate-300 dark:border-slate-600 text-slate-400"}`}
                >
                  {ok ? "✓" : "○"} {n}
                </span>
              );
            })}
          </div>
          {needs.some(({ src }) => src && !isDone(src) && !["approved", "submitted", "draft"].includes(str(src.tool_state?.state))) && (
            <p className="text-xs text-slate-400">You can generate now. Missing inputs make the draft thinner, and you can regenerate once they&apos;re ready.</p>
          )}
        </div>
      )}

      {LINK_TASKS.has(task.title) && (
        <div>
          <label className={label} htmlFor="g-links">Live page links (one per line)</label>
          <textarea
            id="g-links"
            className={`${field} min-h-[70px] font-mono text-xs`}
            placeholder={"https://…\nhttps://…"}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            onBlur={() => links !== str(ts.links) && start(() => updateToolState(task.id, { links }))}
          />
        </div>
      )}

      {busy ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">Writing {task.title.toLowerCase()} for {client.business_name || client.name}… this takes a minute or two.</p>
          <pre ref={liveRef} className="whitespace-pre-wrap text-xs leading-relaxed bg-slate-50 dark:bg-slate-800/60 rounded-md p-3 max-h-72 overflow-y-auto font-sans">
            {live || "Starting…"}
          </pre>
        </div>
      ) : saved ? (
        <div className="flex flex-col gap-2">
          <label className={label} htmlFor="g-text">
            {approved ? "Approved" : "Draft"}
            {ts.truncated ? " · may be cut off at the end" : ""}
          </label>
          <textarea
            id="g-text"
            className={`${field} min-h-[320px] text-xs leading-relaxed`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text !== saved && start(() => updateToolState(task.id, { text }))}
          />
          <div className="flex flex-wrap gap-2">
            {!approved && (
              <button
                className={btnPrimary}
                onClick={() =>
                  start(async () => {
                    await updateToolState(task.id, { text, state: "approved" }, "internally_reviewed");
                    toast("Approved");
                  })
                }
              >
                Approve
              </button>
            )}
            {str(ts.doc_url) ? (
              <a href={str(ts.doc_url)} target="_blank" rel="noopener noreferrer" className={`${btn} flex items-center gap-1`}>
                Open Google Doc <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button className={btn} disabled={saving} onClick={saveToDrive}>
                {saving ? "Saving…" : client.google_drive_url ? "Save to client's Drive folder" : "Save to Google Drive"}
              </button>
            )}
            <button className={btn} onClick={generate}>Regenerate</button>
          </div>
        </div>
      ) : null}

      {!busy && (
        <div className="flex flex-col gap-2">
          <div>
            <label className={label} htmlFor="g-notes">{saved ? "Notes for the next draft" : "Notes for this draft (optional)"}</label>
            <textarea
              id="g-notes"
              className={`${field} min-h-[56px]`}
              placeholder="Angles, offers, things to include or avoid"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {!saved && (
            <button className={`${btnPrimary} self-start`} onClick={generate}>
              Generate {task.title}
            </button>
          )}
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
