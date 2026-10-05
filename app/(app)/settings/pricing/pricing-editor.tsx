"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { tierCard, type PricingTier } from "@/lib/flow";
import { addPricingTier, deletePricingTier, updatePricingTier } from "@/app/actions/flow";
import { useToast } from "@/components/flow/ui";
import { MigrationNotice } from "@/components/flow/migration-notice";

const control = "text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2 py-1.5";

export default function PricingEditor({ tiers, migrated }: { tiers: PricingTier[]; migrated: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-5">
      {!migrated && <MigrationNotice />}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pricing</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            The tiers the proposal generator chooses from. Changes apply to the next proposal you generate.
          </p>
        </div>
        <button
          disabled={pending || !migrated}
          onClick={() => start(() => addPricingTier())}
          className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add tier
        </button>
      </header>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <th className="px-4 py-2.5 font-semibold">Tier &amp; what&apos;s included</th>
              <th className="px-4 py-2.5 font-semibold">Price (R)</th>
              <th className="px-4 py-2.5 font-semibold">Billed</th>
              <th className="px-4 py-2.5 font-semibold">Minimum term</th>
              <th className="px-4 py-2.5 font-semibold">Shows in proposal as</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <TierRow key={t.id} tier={t} />
            ))}
            {!tiers.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-400">No tiers yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-4 py-2.5">
        Totals for minimum terms are worked out for you, so the proposal PDF and the cover email always show the same figure.
      </p>
    </div>
  );
}

function TierRow({ tier }: { tier: PricingTier }) {
  const [name, setName] = useState(tier.name);
  const [amount, setAmount] = useState(String(tier.amount));
  const [desc, setDesc] = useState(tier.description ?? "");
  useEffect(() => { setName(tier.name); setAmount(String(tier.amount)); setDesc(tier.description ?? ""); }, [tier.name, tier.amount, tier.description]);
  const [, start] = useTransition();
  const toast = useToast();
  const save = (u: Parameters<typeof updatePricingTier>[1]) => start(() => updatePricingTier(tier.id, u));
  const preview = tierCard({ ...tier, name, amount: Number(amount) || 0 });

  return (
    <tr className="border-b last:border-0 border-slate-100 dark:border-slate-800">
      <td className="px-4 py-2.5 min-w-[280px]">
        <input aria-label="Tier name" className={`${control} w-full`} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== tier.name && save({ name })} />
        <textarea
          aria-label={`What ${tier.name} includes`}
          placeholder="What's included. The proposal generator uses this to write the deliverables."
          className={`${control} w-full mt-1.5 text-xs min-h-[54px]`}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => desc !== (tier.description ?? "") && save({ description: desc })}
        />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
            <input type="checkbox" checked={tier.is_from} onChange={(e) => save({ is_from: e.target.checked })} /> from
          </label>
          <input
            aria-label="Price in rand"
            type="number"
            min={0}
            step={100}
            className={`${control} w-28 tabular-nums`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => Number(amount) !== tier.amount && save({ amount: Math.max(0, Math.round(Number(amount) || 0)) })}
          />
        </div>
      </td>
      <td className="px-4 py-2.5">
        <select aria-label="Billing" className={control} value={tier.cadence} onChange={(e) => save({ cadence: e.target.value as "month" | "once" })}>
          <option value="month">Monthly</option>
          <option value="once">Once-off</option>
        </select>
      </td>
      <td className="px-4 py-2.5">
        <select aria-label="Minimum term" className={control} value={tier.min_months} disabled={tier.cadence === "once"} onChange={(e) => save({ min_months: Number(e.target.value) })}>
          {[0, 3, 6, 12].map((m) => (
            <option key={m} value={m}>{m ? `${m} months` : "None"}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2.5">
        <p className="font-semibold tabular-nums">{preview.price}</p>
        <p className="text-xs text-slate-400">
          {preview.cadence}
          {preview.total ? ` · ${preview.total}` : ""}
        </p>
      </td>
      <td className="px-4 py-2.5">
        <button
          aria-label={`Remove ${tier.name}`}
          onClick={() =>
            start(async () => {
              await deletePricingTier(tier.id);
              toast(`Removed ${tier.name}`);
            })
          }
          className="text-slate-400 hover:text-rose-600 p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
