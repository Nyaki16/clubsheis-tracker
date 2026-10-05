"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Plus } from "lucide-react";
import Markdown from "@/components/flow/markdown";

export type ChatMessage = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "What did we agree in this week's Team Scrolls?",
  "What's overdue, and who owns it?",
  "Catch me up on Anele Somaguda",
  "What has Debbie recommended this week?",
];

export function DebbieAvatar({ size = 28 }: { size?: number }) {
  return (
    <span
      className="rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 text-white font-bold grid place-items-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden
    >
      D
    </span>
  );
}

export default function DebbieChat({
  chatId: initialChatId,
  initialMessages = [],
  onChatChange,
  compact = false,
}: {
  chatId?: string | null;
  initialMessages?: ChatMessage[];
  onChatChange?: (id: string | null) => void;
  compact?: boolean;
}) {
  const [chatId, setChatId] = useState<string | null>(initialChatId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const [from, setFrom] = useState(initialChatId ?? null);
  if ((initialChatId ?? null) !== from) {
    setFrom(initialChatId ?? null);
    setChatId(initialChatId ?? null);
    setMessages(initialMessages);
    setSteps([]);
    setError("");
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, steps]);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setInput("");
    setError("");
    setBusy(true);
    setSteps([]);
    setMessages((m) => [...m, { role: "user", text }]);
    try {
      const res = await fetch("/api/debbie/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: text }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Debbie couldn't answer that.");
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
          if (msg.type === "chat" && msg.chatId !== chatId) {
            setChatId(msg.chatId);
            setFrom(msg.chatId);
            onChatChange?.(msg.chatId);
          }
          if (msg.type === "status") setSteps((s) => [...s, msg.text]);
          if (msg.type === "text") setMessages((m) => [...m, { role: "assistant", text: msg.text }]);
          if (msg.type === "error") throw new Error(msg.error);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Debbie couldn't answer that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`flex-1 min-h-0 overflow-y-auto ${compact ? "px-4" : "px-1"} py-4 flex flex-col gap-4`}>
        {!messages.length && (
          <div className="flex flex-col gap-4 my-auto">
            <div className="flex items-center gap-3">
              <DebbieAvatar size={40} />
              <div>
                <p className="font-semibold">Ask Debbie</p>
                <p className="text-sm text-slate-500">
                  I&apos;ve read every meeting this year: Team Scroll, Boardroom, client calls and one-on-ones. Ask me anything that was said, or where any work stands.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="text-left text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-500/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="self-end max-w-[85%] bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-2xl rounded-br-md px-3.5 py-2 text-sm whitespace-pre-wrap">
              {m.text}
            </div>
          ) : (
            <div key={i} className="flex gap-2.5 max-w-full">
              <DebbieAvatar />
              <div className="min-w-0 flex-1">
                <Markdown text={m.text} />
              </div>
            </div>
          )
        )}
        {busy && (
          <div className="flex gap-2.5">
            <DebbieAvatar />
            <div className="text-xs text-slate-500 flex flex-col gap-1 pt-1">
              {(steps.length ? steps : ["Thinking"]).map((s, i, arr) => (
                <span key={i} className={i === arr.length - 1 ? "animate-pulse" : "text-slate-400"}>
                  {i === arr.length - 1 ? `${s}…` : `✓ ${s}`}
                </span>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className={`border-t border-slate-200 dark:border-slate-800 ${compact ? "p-3" : "pt-3"} flex items-end gap-2`}
      >
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => { setChatId(null); setFrom(null); setMessages([]); setSteps([]); onChatChange?.(null); }}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="New chat"
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={1}
          placeholder="Ask Debbie anything that was said in a meeting…"
          aria-label="Ask Debbie"
          className="flex-1 resize-none max-h-40 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500"
        />
        <button
          disabled={busy || !input.trim()}
          className="p-2 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white disabled:opacity-40"
          aria-label="Send"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
