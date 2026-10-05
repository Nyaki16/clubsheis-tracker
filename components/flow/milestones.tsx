"use client";

import { useTransition } from "react";
import { Flag } from "lucide-react";
import type { Client, Profile } from "@/lib/types";
import { setGhuttePaid, setProposalAccepted } from "@/app/actions/ghutte";
import { useToast } from "./ui";

const day = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

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

  const run = (fn: () => Promise<{ note: string }>) =>
    start(async () => {
      try {
        const r = await fn();
        toast(r.note || "Done");
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
      {(both || client.ghutte_error) && (
        <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs flex flex-col gap-1">
          {both && (
            <p className="text-slate-600 dark:text-slate-300">
              <span className="font-semibold">Ghutte:</span> Mpume has the “Create Ghutte sub-account” task in Onboarding: she creates the sub-account, adds{" "}
              {client.name.split(" ")[0]} as a user and sends their login.
            </p>
          )}
          {client.ghutte_error && <p className="text-rose-600">{client.ghutte_error}</p>}
        </div>
      )}
    </div>
  );
}
