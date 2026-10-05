"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { usePackages } from "@/components/flow/packages-context";
import { PHASES, packageDiff, packageLabel, type FlowTemplate, type PackageId } from "@/lib/flow";
import type { Client, Profile, Task } from "@/lib/types";
import { changeClientPackage, createFlowClient, updateClientDetails } from "@/app/actions/flow";
import { PhaseDot, useToast } from "./ui";

const field = "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2.5 py-1.5 text-sm";
const label = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5";

function Shell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">{children}</div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

type Details = {
  name: string;
  business_name: string;
  email: string;
  phone: string;
  website_url: string;
  instagram_url: string;
  google_drive_url: string;
  lead_id: string;
};

function DetailFields({ d, set, profiles }: { d: Details; set: (k: keyof Details, v: string) => void; profiles: Profile[] }) {
  const input = (k: keyof Details, l: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={label} htmlFor={`c-${k}`}>{l}</label>
      <input id={`c-${k}`} className={field} value={d[k]} onChange={(e) => set(k, e.target.value)} {...props} />
    </div>
  );
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {input("name", "Client name", { required: true, placeholder: "e.g. Lindiwe Dube" })}
        {input("business_name", "Business / brand", { placeholder: "e.g. Glow Studio" })}
        {input("email", "Email", { type: "email", placeholder: "Proposals and emails go here" })}
        {input("phone", "Phone / WhatsApp", { type: "tel", placeholder: "+27 …" })}
        {input("website_url", "Website", { placeholder: "example.co.za" })}
        {input("instagram_url", "Instagram", { placeholder: "@handle" })}
      </div>
      {input("google_drive_url", "Google Drive folder", { type: "url", placeholder: "https://drive.google.com/drive/folders/…" })}
      <div>
        <label className={label} htmlFor="c-lead">Lead</label>
        <select id="c-lead" className={field} value={d.lead_id} onChange={(e) => set("lead_id", e.target.value)}>
          <option value="">No lead</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.job_title ? ` · ${p.job_title}` : ""}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function PackagePicker({ value, onChange, includeLead }: { value: PackageId; onChange: (p: PackageId) => void; includeLead?: boolean }) {
  const packages = usePackages();
  return (
    <div>
      <p className={label}>Package</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {packages.filter((p) => includeLead || p.id !== "lead").map((p) => (
          <button
            type="button"
            key={p.id}
            aria-pressed={p.id === value}
            onClick={() => onChange(p.id)}
            className={`text-left rounded-lg border px-3 py-2 ${
              p.id === value ? "border-purple-500 ring-2 ring-purple-500/20" : "border-slate-300 dark:border-slate-700 hover:border-slate-400"
            }`}
          >
            <span className="block text-sm font-semibold">{p.label}</span>
            <span className="block text-xs text-slate-400">{p.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TemplatePreview({ templates, pkg }: { templates: FlowTemplate[]; pkg: PackageId }) {
  const rows = templates.filter((t) => t.package === pkg);
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-4 py-3 flex flex-col gap-1.5" aria-live="polite">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">This package issues {rows.length} tasks</p>
      {PHASES.map((ph) => {
        const list = rows.filter((t) => t.phase === ph.id).sort((a, b) => a.position - b.position);
        if (!list.length) return null;
        return (
          <div key={ph.id} className="flex items-center gap-2 text-xs min-w-0">
            <PhaseDot phase={ph.id} />
            <span className="font-medium shrink-0">{ph.label}</span>
            <span className="text-slate-400 truncate flex-1">{list.map((t) => t.title).join(", ")}</span>
            <span className="text-slate-400 tabular-nums">{list.length}</span>
          </div>
        );
      })}
    </div>
  );
}

const blank: Details = { name: "", business_name: "", email: "", phone: "", website_url: "", instagram_url: "", google_drive_url: "", lead_id: "" };

export function NewClientModal({
  templates,
  profiles,
  defaultLeadId,
  onClose,
}: {
  templates: FlowTemplate[];
  profiles: Profile[];
  defaultLeadId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [d, setD] = useState<Details>({ ...blank, lead_id: defaultLeadId ?? "" });
  const [pkg, setPkg] = useState<PackageId>("page");
  const [error, setError] = useState("");
  const count = templates.filter((t) => t.package === pkg).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      try {
        const r = await createFlowClient({ ...d, lead_id: d.lead_id || null, package: pkg });
        toast(`${r.issued} tasks issued from the ${packageLabel(pkg)} template`);
        onClose();
        router.push(`/clients/${r.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create the client.");
      }
    });
  }

  return (
    <form onSubmit={submit}>
      <Shell
        title="New client"
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={pending} className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-60">
              {pending ? "Creating…" : `Create client + ${count} tasks`}
            </button>
          </>
        }
      >
        <DetailFields d={d} set={(k, v) => setD((x) => ({ ...x, [k]: v }))} profiles={profiles} />
        <PackagePicker value={pkg} onChange={setPkg} />
        <TemplatePreview templates={templates} pkg={pkg} />
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </Shell>
    </form>
  );
}

export function EditClientModal({
  client,
  tasks,
  templates,
  profiles,
  onClose,
}: {
  client: Client;
  tasks: Task[];
  templates: FlowTemplate[];
  profiles: Profile[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [d, setD] = useState<Details>({
    name: client.name,
    business_name: client.business_name ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    website_url: client.website_url ?? "",
    instagram_url: client.instagram_url ?? "",
    google_drive_url: client.google_drive_url ?? "",
    lead_id: client.lead_id ?? "",
  });
  const current = (client.package ?? "lead") as PackageId;
  const [pkg, setPkg] = useState<PackageId>(current);
  const diff = useMemo(
    () => (pkg === current ? null : packageDiff(tasks, templates.filter((t) => t.package === pkg))),
    [pkg, current, tasks, templates]
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      try {
        await updateClientDetails(client.id, { ...d, lead_id: d.lead_id || null });
        if (pkg !== current) {
          const r = await changeClientPackage(client.id, pkg);
          toast(`Now ${packageLabel(pkg)}: ${r.added} tasks added, ${r.removed} removed`);
        } else toast("Details saved");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  const chips = (list: { title: string }[], tone: string) => (
    <span className="flex flex-wrap gap-1.5">
      {list.slice(0, 6).map((x) => (
        <span key={x.title} className={`text-xs px-2 py-0.5 rounded-full ${tone}`}>{x.title}</span>
      ))}
      {list.length > 6 && <span className="text-xs text-slate-400">+{list.length - 6} more</span>}
    </span>
  );

  return (
    <form onSubmit={submit}>
      <Shell
        title="Client details"
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={pending} className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-md disabled:opacity-60">
              {pending ? "Saving…" : "Save details"}
            </button>
          </>
        }
      >
        <DetailFields d={d} set={(k, v) => setD((x) => ({ ...x, [k]: v }))} profiles={profiles} />
        <PackagePicker value={pkg} onChange={setPkg} includeLead={current === "lead"} />
        {diff && (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-4 py-3 flex flex-col gap-2 text-xs" aria-live="polite">
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              Switching {packageLabel(current)} → {packageLabel(pkg)}
            </p>
            {diff.add.length > 0 && <div className="flex gap-3"><span className="w-36 shrink-0">Adds {diff.add.length}</span>{chips(diff.add, "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300")}</div>}
            {diff.remove.length > 0 && <div className="flex gap-3"><span className="w-36 shrink-0">Removes {diff.remove.length} not started</span>{chips(diff.remove, "border border-dashed border-slate-300 dark:border-slate-600 text-slate-500")}</div>}
            {diff.keepStarted.length > 0 && <div className="flex gap-3"><span className="w-36 shrink-0">Keeps {diff.keepStarted.length} in progress</span>{chips(diff.keepStarted, "border border-slate-300 dark:border-slate-600")}</div>}
            {!diff.add.length && !diff.remove.length && !diff.keepStarted.length && <p>Same tasks, nothing changes.</p>}
          </div>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </Shell>
    </form>
  );
}
