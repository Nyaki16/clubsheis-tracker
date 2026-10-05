"use client";

import { useState } from "react";
import { YS_SECTIONS, type YsKey } from "@/lib/yellow-sheet";

// ClubSheIs brand on the client-facing form (same burgundy as the proposal PDF).
const ACCENT = "#70262D";

export default function YellowSheetForm({
  taskId,
  firstName,
  initial,
  submittedAt,
}: {
  taskId: string;
  firstName: string;
  initial: Record<string, string>;
  submittedAt: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(YS_SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, initial[f.key] ?? ""]))
  );
  const [state, setState] = useState<"idle" | "sending" | "done">(submittedAt ? "done" : "idle");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(!submittedAt);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("sending");
    try {
      const res = await fetch(`/api/yellow-sheet/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong. Please try again.");
      setState("done");
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("idle");
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] dark:bg-stone-950 text-[#291F1F] dark:text-stone-100 px-4 py-10 sm:py-14">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <header className="flex flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/csi-logo.png" alt="Club She Is" className="w-24 h-auto" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
            Your Yellow Sheet
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-balance">
            {firstName ? `${firstName}, tell us about your business` : "Tell us about your business"}
          </h1>
          <p className="text-base text-[#685B5A] dark:text-stone-400 max-w-prose">
            Your answers become your sales page, your email sequence and your first month of content, so the more you tell us in your own words, the more it will sound like you. It takes about 15 minutes.
          </p>
        </header>

        {state === "done" && !editing ? (
          <section className="rounded-2xl bg-white dark:bg-stone-900 border border-[#E7DDDD] dark:border-stone-800 p-6 sm:p-8 flex flex-col gap-3">
            <p className="text-xl font-semibold">Thank you{firstName ? `, ${firstName}` : ""}. We&apos;ve got everything.</p>
            <p className="text-[#685B5A] dark:text-stone-400">
              The team will start on your copy and let you know when your drafts are ready. If you think of anything else, you can update your answers any time.
            </p>
            <button onClick={() => setEditing(true)} className="self-start text-sm font-semibold underline underline-offset-4" style={{ color: ACCENT }}>
              Update my answers
            </button>
          </section>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-8">
            {YS_SECTIONS.map((section, si) => (
              <section key={section.title} className="rounded-2xl bg-white dark:bg-stone-900 border border-[#E7DDDD] dark:border-stone-800 p-5 sm:p-7 flex flex-col gap-5">
                <h2 className="flex items-baseline gap-3 text-lg font-semibold">
                  <span className="text-sm font-semibold tabular-nums" style={{ color: ACCENT }}>
                    {si + 1}
                  </span>
                  {section.title}
                </h2>
                {section.fields.map((f) => {
                  const id = `ys-${f.key}`;
                  const common = {
                    id,
                    value: values[f.key] ?? "",
                    placeholder: f.placeholder,
                    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                      setValues((v) => ({ ...v, [f.key as YsKey]: e.target.value })),
                    className:
                      "w-full rounded-lg border border-[#E5DEDE] dark:border-stone-700 bg-[#FCFBFA] dark:bg-stone-950 px-3.5 py-2.5 text-base outline-none focus:border-[#70262D] focus:ring-2 focus:ring-[#70262D]/15",
                  };
                  return (
                    <div key={f.key} className="flex flex-col gap-1.5">
                      <label htmlFor={id} className="text-sm font-medium">
                        {f.label}
                      </label>
                      {f.rows === 1 ? <input {...common} /> : <textarea {...common} rows={f.rows} />}
                    </div>
                  );
                })}
              </section>
            ))}
            {error && <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={state === "sending"}
              className="self-start rounded-full px-6 py-3 text-base font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: ACCENT }}
            >
              {state === "sending" ? "Sending…" : "Send my Yellow Sheet"}
            </button>
          </form>
        )}

        <footer className="text-xs text-[#685B5A] dark:text-stone-500">Club She Is · info@clubsheis.com</footer>
      </div>
    </main>
  );
}
