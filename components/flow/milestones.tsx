"use client";

import { useTransition } from "react";
import { Flag, RefreshCw } from "lucide-react";
import type { Client, Profile } from "@/lib/types";
import { resendGhutteLogin, retryGhutteSetup, setGhuttePaid, setProposalAccepted } from "@/app/actions/ghutte";
import { useToast } from "./ui";

const day = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const btn = "text-xs font-medium border border-slate-300 dark:border-slate-600 px-2 py-1 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1";

function Row({
  done,
  label,
  detail,
  disabled,
  onChange,
}: {
  done: boolean;
  label: string;
  detail: React.ReactNode;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-3 px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 cursor-pointer ${done ? "bg-emerald-50/50 dark:bg-emerald-500/5" : ""}`}>
      <input type="checkbox" className="w-4 h-4 accent-emerald-600" checked={done} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <Flag className={`w-4 h-4 shrink-0 ${done ? "text-emerald-600" : "text-slate-400"}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {label} <span className="ml-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Milestone</span>
        </span>
        <span className="block text-xs text-slate-500">{detail}</span>
      </span>
    </label>
  );
}

/** Proposal Accepted and Ghutte Payment Made, with the Ghutte setup they trigger. */
export default function Milestones({ client, profiles }: { client: Client; profiles: Profile[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const who = (id: string | null | undefined) => profiles.find((p) => p.id === id)?.name ?? "the team";
  const pay = (client.ghutte_payment ?? {}) as Record<string, string | null>;
  const both = !!client.proposal_accepted_at && !!client.ghutte_paid_at;

  const run = (fn: () => Promise<{ note: string } | void>, ok?: string) =>
    start(async () => {
      try {
        const r = await fn();
        toast((r && r.note) || ok || "Done");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Something went wrong.");
      }
    });

  return (
    <div>
      <Row
        done={!!client.proposal_accepted_at}
        label="Proposal Accepted"
        disabled={pending}
        onChange={(on) => run(() => setProposalAccepted(client.id, on))}
        detail={
          client.proposal_accepted_at
            ? `Ticked by ${who(client.proposal_accepted_by)} · ${day(client.proposal_accepted_at)}${client.ghl_contact_id ? " · tagged in GHL" : ""}`
            : "Tick when they say yes. This tags them in GHL and starts your workflow."
        }
      />
      <Row
        done={!!client.ghutte_paid_at}
        label="Ghutte Payment Made"
        disabled={pending}
        onChange={(on) => {
          if (!on && !window.confirm("Untick Ghutte Payment Made?")) return;
          run(() => setGhuttePaid(client.id, on));
        }}
        detail={
          client.ghutte_paid_at
            ? `${pay.source === "GHL" ? "Paid via GHL" : "Ticked by hand"} · ${day(client.ghutte_paid_at)}${pay.amount ? ` · ${pay.currency ?? ""} ${pay.amount}` : ""}`
            : "Ticks itself when GHL reports the payment. Paid another way? Tick it here."
        }
      />
      {(both || client.ghutte_error || client.ghutte_location_id) && (
        <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-semibold text-slate-600 dark:text-slate-300">Ghutte:</span>
          <span className={client.ghutte_location_id ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400"}>
            {client.ghutte_location_id ? "✓ sub-account created" : "○ sub-account"}
          </span>
          <span className={client.ghutte_user_id ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400"}>
            {client.ghutte_user_id ? "✓ added as a user" : "○ user"}
          </span>
          <span className={client.ghutte_login_sent_at ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400"}>
            {client.ghutte_login_sent_at ? `✓ login emailed ${day(client.ghutte_login_sent_at)}` : "○ login email"}
          </span>
          {client.ghutte_location_id && (
            <a className="underline text-slate-600 dark:text-slate-300" href={`https://app.gohighlevel.com/location/${client.ghutte_location_id}/dashboard`} target="_blank" rel="noopener noreferrer">
              Open in Ghutte
            </a>
          )}
          <span className="ml-auto flex gap-2">
            {both && (!client.ghutte_location_id || !client.ghutte_user_id) && (
              <button className={btn} disabled={pending} onClick={() => run(() => retryGhutteSetup(client.id))}>
                <RefreshCw className="w-3 h-3" /> Try again
              </button>
            )}
            {client.ghutte_user_id && (
              <button
                className={btn}
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`Set a new temporary password for ${client.name} and email it?`)) return;
                  run(() => resendGhutteLogin(client.id), "New login emailed");
                }}
              >
                Resend login
              </button>
            )}
          </span>
          {client.ghutte_error && <p className="basis-full text-rose-600">{client.ghutte_error}</p>}
        </div>
      )}
    </div>
  );
}
