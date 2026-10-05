"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Plus, X } from "lucide-react";
import { tierCard, type PricingTier } from "@/lib/flow";
import { buildProposalEmailBody, type PricingCard, type ProposalData } from "@/lib/proposal-template";
import type { ProposalState } from "@/lib/proposal-server";
import type { Client, Task } from "@/lib/types";
import { updateToolState } from "@/app/actions/flow";
import { useToast } from "./ui";

const field = "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5 text-sm";
const label = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5";
const btnPrimary = "text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50";
const btn = "text-sm font-medium border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";

const fmt = (iso?: string | null) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
};

// Read the generate route's progress stream until it reports done or error.
async function runGenerate(taskId: string, notes: string, onProgress: (chars: number) => void) {
  const res = await fetch("/api/proposal/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, notes }),
  });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Couldn't start the proposal (${res.status}).`);
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
        return msg.data as ProposalData;
      }
    }
  }
  throw new Error("The connection closed before the proposal finished. Refresh to check whether it saved.");
}

export default function ProposalTool({
  task,
  client,
  clientTasks,
  tiers,
  onEditClient,
}: {
  task: Task;
  client: Client;
  clientTasks: Task[];
  tiers: PricingTier[];
  onEditClient?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const ts = task.tool_state as ProposalState;
  const discovery = clientTasks.find((t) => t.tool === "discovery");
  const dts = (discovery?.tool_state ?? {}) as Record<string, string>;
  const hasNotes = !!(dts.need || dts.transcript || client.call_message);

  const [notes, setNotes] = useState(ts.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [chars, setChars] = useState(0);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(ts.state !== "sent");
  const [stateFrom, setStateFrom] = useState(ts.state);
  if (ts.state !== stateFrom) {
    setStateFrom(ts.state);
    setEditing(ts.state !== "sent");
  }

  async function generate() {
    setBusy(true);
    setError("");
    setChars(0);
    try {
      await runGenerate(task.id, notes, setChars);
      toast("Proposal ready to review");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!ts.data || busy) {
    return (
      <div className="flex flex-col gap-3">
        <InputChip ok={hasNotes} label="Discovery call notes" />
        <p className="text-xs text-slate-500">
          Turns the discovery notes into the 8-page proposal PDF, picking tiers from your Pricing page, then writes a short cover email that summarises it.
        </p>
        <div>
          <label className={label} htmlFor="p-notes">Instructions for this proposal (optional)</label>
          <textarea
            id="p-notes"
            className={`${field} min-h-[60px]`}
            placeholder="e.g. Recommend Gold for 3 months, then Growth Support"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {busy ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Writing the proposal… {chars > 0 ? `${Math.round(chars / 6)} words so far` : "reading the discovery notes"}. This takes a minute or two.
          </p>
        ) : (
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={!hasNotes} onClick={generate}>Generate proposal</button>
          </div>
        )}
        {!hasNotes && <p className="text-xs text-slate-400">Add notes to the Discovery call task first.</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <ProposalEditor
      key={`${task.id}-${ts.generated_at}`}
      task={task}
      client={client}
      tiers={tiers}
      data={ts.data}
      ts={ts}
      editing={editing}
      onEditAgain={() => start(async () => {
        await updateToolState(task.id, { state: "ready" }, "in_review");
        setEditing(true);
      })}
      onRegenerate={generate}
      onEditClient={onEditClient}
      error={error}
    />
  );
}

function InputChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`self-start text-xs px-2 py-0.5 rounded-full ${ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "border border-dashed border-slate-300 dark:border-slate-600 text-slate-400"}`}>
      {ok ? "✓" : "○"} {label}
    </span>
  );
}

function ProposalEditor({
  task,
  client,
  tiers,
  data,
  ts,
  editing,
  onEditAgain,
  onRegenerate,
  onEditClient,
  error,
}: {
  task: Task;
  client: Client;
  tiers: PricingTier[];
  data: ProposalData;
  ts: ProposalState;
  editing: boolean;
  onEditAgain: () => void;
  onRegenerate: () => void;
  onEditClient?: () => void;
  error: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [cards, setCards] = useState<PricingCard[]>(data.cards);
  const first = client.name.split(" ")[0];
  const autoBody = useMemo(
    () => buildProposalEmailBody({ ...data, cards }, { clientName: first, brandName: client.business_name }),
    [data, cards, first, client.business_name]
  );
  const [body, setBody] = useState(ts.email_body ?? "");
  const [to, setTo] = useState(ts.sent_to ?? client.email ?? "");
  const subject = `ClubSheIs Proposal for ${client.business_name || client.name}`;
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const saveCards = (next: PricingCard[]) => {
    setCards(next);
    start(() => updateToolState(task.id, { data: { ...data, cards: next } }));
  };
  const setCard = (i: number, patch: Partial<PricingCard>) => setCards((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const commit = () => start(() => updateToolState(task.id, { data: { ...data, cards } }));

  function pickTier(i: number, name: string) {
    const tier = tiers.find((t) => t.name.trim() === name.trim());
    if (!tier) return;
    const c = tierCard(tier);
    const next = cards.map((x, k) =>
      k === i
        ? { ...x, name: tier.name, price: c.price, cadence: tier.cadence === "month" ? "per month" : "once-off", totalNote: c.total.toUpperCase() }
        : x
    );
    saveCards(next);
  }

  async function send() {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`/api/proposal/${task.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body: body || autoBody }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't send.");
      toast(`Sent to ${to} with the proposal PDF and About Us attached`);
      router.refresh();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        <PdfCard taskId={task.id} client={client} data={data} />
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          ✓ Sent to {ts.sent_to}
          {fmt(ts.sent_at) ? ` on ${fmt(ts.sent_at)}` : ""} ·{" "}
          {ts.opened_at ? `opened${fmt(ts.opened_at) ? ` ${fmt(ts.opened_at)}` : ""}` : "not opened yet"}
        </p>
        <button className={`${btn} self-start`} onClick={onEditAgain}>Edit and resend</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className={label}>Pricing in the proposal</p>
        <datalist id="pricing-tiers">
          {tiers.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
        <div className="flex flex-col gap-2">
          {cards.map((c, i) => (
            <div key={i} className="grid grid-cols-[140px_minmax(0,1fr)_24px] gap-1.5 items-center p-2 border border-slate-200 dark:border-slate-700 rounded-lg">
              <input
                className={`${field} col-span-3`}
                list="pricing-tiers"
                aria-label={`Option ${i + 1} name`}
                value={c.name}
                onChange={(e) => setCard(i, { name: e.target.value })}
                onBlur={(e) => (tiers.some((t) => t.name.trim() === e.target.value.trim()) ? pickTier(i, e.target.value) : commit())}
                placeholder="Pick a tier or type a custom option"
              />
              <input className={field} aria-label={`Option ${i + 1} price`} value={c.price} onChange={(e) => setCard(i, { price: e.target.value })} onBlur={commit} />
              <input
                className={field}
                aria-label={`Option ${i + 1} term`}
                value={c.totalNote || c.cadence}
                onChange={(e) => setCard(i, /total/i.test(e.target.value) ? { totalNote: e.target.value } : { cadence: e.target.value, totalNote: "" })}
                onBlur={commit}
              />
              <button aria-label={`Remove option ${i + 1}`} className="text-slate-400 hover:text-rose-600" onClick={() => saveCards(cards.filter((_, k) => k !== i))}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          className={`${btn} mt-2 text-xs flex items-center gap-1`}
          onClick={() => saveCards([...cards, { eyebrow: "", name: "", subtitle: "", price: "", cadence: "per month", totalNote: "", features: [] }])}
        >
          <Plus className="w-3.5 h-3.5" /> Add option
        </button>
      </div>

      <PdfCard taskId={task.id} client={client} data={{ ...data, cards }} />

      <div className="border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-14">To</span>
            <input className={`${field} py-1`} type="email" aria-label="Send to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Client's email" />
            {!client.email && onEditClient && (
              <button className="text-xs underline whitespace-nowrap" onClick={onEditClient}>Save to client</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-14">Subject</span>
            <span className="font-medium">{subject}</span>
          </div>
        </div>
        <textarea
          aria-label="Email message"
          className="w-full bg-transparent px-3 py-2 min-h-[220px] resize-y outline-none"
          value={body || autoBody}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => start(() => updateToolState(task.id, { email_body: body || null }))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={btnPrimary} disabled={sending || !to.trim()} onClick={send}>
          {sending ? "Sending…" : `${ts.sent_at ? "Resend" : "Send"} to ${first}`}
        </button>
        <button className={btn} onClick={onRegenerate}>Regenerate</button>
        {body && body !== autoBody && (
          <button className={btn} onClick={() => { setBody(""); start(() => updateToolState(task.id, { email_body: null })); }}>
            Reset email
          </button>
        )}
      </div>
      {(sendError || error) && <p className="text-sm text-rose-600">{sendError || error}</p>}
    </div>
  );
}

function PdfCard({ taskId, client, data }: { taskId: string; client: Client; data: ProposalData }) {
  return (
    <div className="flex items-center gap-3 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5">
      <div className="w-9 h-11 rounded bg-gradient-to-br from-[#70262D] to-[#9a3a43] text-white text-[9px] font-bold grid place-items-end justify-center pb-1 shrink-0">
        <FileText className="w-4 h-4 mb-0.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">Proposal — {client.business_name || client.name}.pdf</p>
        <p className="text-xs text-slate-400 truncate">
          {data.headlineLead}
          {data.headlineAccent} · {data.cards.length} pricing option{data.cards.length === 1 ? "" : "s"} · sent with the About Us PDF
        </p>
      </div>
      <a href={`/api/proposal/${taskId}/pdf`} target="_blank" rel="noopener noreferrer" className={`${btn} text-xs flex items-center gap-1`}>
        Preview <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
