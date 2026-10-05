"use client";

import { useState, useTransition } from "react";
import { Check, Copy, X } from "lucide-react";
import { newGhutteWebhookSecret, saveGhutteSettings } from "@/app/actions/ghutte";
import type { GhutteSettings } from "@/lib/ghutte";
import { useToast } from "@/components/flow/ui";

const field = "w-full text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5";
const card = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-3";
const btn = "text-xs font-medium border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5";

function Status({ ok, label, fix }: { ok: boolean; label: string; fix: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <Check className="w-4 h-4 mt-0.5 text-emerald-600" /> : <X className="w-4 h-4 mt-0.5 text-rose-600" />}
      <span>
        {label}
        {!ok && <span className="block text-xs text-slate-500">{fix}</span>}
      </span>
    </li>
  );
}

export default function GhutteSetup({
  settings,
  webhookUrl,
  env,
  unmatched,
}: {
  settings: GhutteSettings;
  webhookUrl: string;
  env: { clubsheisKey: boolean; agencyKey: boolean; gmail: boolean };
  unmatched: Record<string, string | null>[];
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [tag, setTag] = useState(settings.tag);
  const [loginUrl, setLoginUrl] = useState(settings.loginUrl);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold">Ghutte</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          The two Sales milestones on every client. <b>Proposal Accepted</b> tags the client in ClubSheIs&apos;s GHL so your workflow runs.{" "}
          <b>Ghutte Payment Made</b> ticks itself when GHL reports the payment. Once both are ticked, Mpume gets the “Create Ghutte sub-account” task with
          the client&apos;s details. She creates it in Ghutte and links it in the task, and the Tracker adds the client as a user and emails their login from
          Gizelle.
        </p>
      </header>

      <section className={card}>
        <h2 className="font-semibold">Connections</h2>
        <ul className="flex flex-col gap-2">
          <Status ok={env.clubsheisKey} label="ClubSheIs GHL key (for the tag)" fix="Add GHL_PIT_KEY_CLUBSHEIS on Vercel (the same key the old Client Flow app uses), then redeploy." />
          <Status ok={env.agencyKey} label="Agency key (listing sub-accounts, adding users)" fix="Add GHL_AGENCY_KEY on Vercel. In GHL's Private Integrations it needs Sub-accounts (view) and Users (view and edit)." />
          <Status ok={env.gmail} label="Gmail (the login email)" fix="Add GMAIL_USER and GMAIL_APP_PASSWORD on Vercel." />
        </ul>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Settings</h2>
        <label className="text-sm flex flex-col gap-1">
          <span className="font-medium">Tag added when the proposal is accepted</span>
          <input className={field} value={tag} onChange={(e) => setTag(e.target.value)} />
          <span className="text-xs text-slate-500">Your GHL workflow should start on “Contact Tag added” with this tag.</span>
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="font-medium">Ghutte login link</span>
          <input className={field} value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} placeholder="e.g. https://app.ghutte.com" />
          <span className="text-xs text-slate-500">Goes in the login email the client receives. Use the address clients log in at.</span>
        </label>
        <button
          className="self-start text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                await saveGhutteSettings({ tag, loginUrl });
                toast("Ghutte settings saved");
              } catch (e) {
                toast(e instanceof Error ? e.message : "Couldn't save.");
              }
            })
          }
        >
          Save
        </button>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Payment webhook (set up once in GHL)</h2>
        {webhookUrl ? (
          <>
            <ol className="list-decimal pl-5 text-sm flex flex-col gap-1.5 text-slate-700 dark:text-slate-300">
              <li>In the ClubSheIs GHL account, go to <b>Automation → Workflows → Create workflow</b>.</li>
              <li>Trigger: <b>Payment Received</b> (or <b>Order Submitted</b>), filtered to the Ghutte product.</li>
              <li>Action: <b>Webhook</b>, method POST, with the link below as the URL.</li>
              <li>Publish the workflow. When a client pays, Ghutte Payment Made ticks on their page within seconds.</li>
            </ol>
            <div className="flex gap-2">
              <input readOnly className={`${field} font-mono text-xs`} value={webhookUrl} onFocus={(e) => e.target.select()} aria-label="Webhook link" />
              <button
                className={btn}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(webhookUrl);
                    toast("Webhook link copied");
                  } catch {
                    toast("Select the link and copy it");
                  }
                }}
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
            <p className="text-xs text-slate-500">
              The link contains a secret: keep it inside GHL.{" "}
              <button
                className="underline"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Make a new link? The old one stops working, so you'll need to paste the new one into GHL.")) return;
                  start(() => newGhutteWebhookSecret());
                }}
              >
                Make a new link
              </button>
            </p>
          </>
        ) : (
          <button className={`${btn} self-start`} disabled={pending} onClick={() => start(() => newGhutteWebhookSecret())}>
            Create the webhook link
          </button>
        )}
        {unmatched.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Payments we couldn&apos;t match to a client</p>
            <ul className="text-sm flex flex-col gap-1">
              {unmatched.map((u, i) => (
                <li key={i} className="text-slate-600 dark:text-slate-300">
                  {u.received_at ? new Date(u.received_at).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""} ·{" "}
                  {u.email || "no email"} {u.amount ? `· ${u.currency ?? ""} ${u.amount}` : ""} {u.product ? `· ${u.product}` : ""}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500 mt-1">Add that email to the right client (Edit details), then tick Ghutte Payment Made on their page.</p>
          </div>
        )}
      </section>
    </div>
  );
}
