"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  BookOpen,
  ExternalLink,
  KeyRound,
  Laptop,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import Modal from "@/components/modal";
import Avatar from "@/components/avatar";
import type {
  Asset,
  AssetInput,
  Profile,
  Sop,
  SopInput,
  VaultLink,
  VaultLinkInput,
} from "@/lib/types";
import {
  createAsset,
  createSop,
  createVaultLink,
  deleteAsset,
  deleteSop,
  deleteVaultLink,
  updateAsset,
  updateSop,
  updateVaultLink,
} from "@/app/actions/csi-home";

type Tab = "assets" | "sops" | "vault" | "hr";

export default function CsiHome({
  assets,
  sops,
  vaultLinks,
  profiles,
}: {
  assets: Asset[];
  sops: Sop[];
  vaultLinks: VaultLink[];
  profiles: Profile[];
}) {
  const [tab, setTab] = useState<Tab>("assets");

  const tabs: { id: Tab; label: string; count: number; Icon: typeof Laptop }[] = [
    { id: "assets", label: "Asset Register", count: assets.length, Icon: Laptop },
    { id: "sops", label: "SOPs", count: sops.length, Icon: BookOpen },
    { id: "vault", label: "Vault links", count: vaultLinks.length, Icon: KeyRound },
    { id: "hr", label: "HR / Team", count: profiles.length, Icon: Users },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">CSI Home</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Internal hub: gear, processes, secrets, people.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                active
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
            >
              <t.Icon className="w-4 h-4" />
              {t.label}
              <span
                className={`text-xs ${
                  active ? "opacity-80" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "assets" && (
        <AssetsPanel assets={assets} profiles={profiles} />
      )}
      {tab === "sops" && <SopsPanel sops={sops} />}
      {tab === "vault" && <VaultPanel links={vaultLinks} />}
      {tab === "hr" && <HrPanel profiles={profiles} />}
    </div>
  );
}

// ── Assets ────────────────────────────────────────────────────────────────

function AssetsPanel({
  assets,
  profiles,
}: {
  assets: Asset[];
  profiles: Profile[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [, startTransition] = useTransition();

  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold">Asset Register</h3>
        <button
          onClick={() => setShowNew(true)}
          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" /> Add asset
        </button>
      </div>
      {assets.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic px-5 py-8 text-center">
          No assets yet — laptops, cameras, mics, etc.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium bg-slate-50 dark:bg-slate-800/40">
            <div className="col-span-3">Asset</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Serial</div>
            <div className="col-span-2">Assigned to</div>
            <div className="col-span-2">Purchased</div>
            <div className="col-span-1" />
          </div>
          {assets.map((a) => {
            const p = a.assigned_to ? profilesById.get(a.assigned_to) : null;
            return (
              <div
                key={a.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-3 group items-center hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <div className="md:col-span-3 min-w-0">
                  <div className="font-medium truncate">{a.name}</div>
                  {a.notes && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {a.notes}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 text-sm text-slate-600 dark:text-slate-300 truncate">
                  {a.category}
                </div>
                <div className="md:col-span-2 text-sm text-slate-600 dark:text-slate-300 truncate font-mono">
                  {a.serial || (
                    <span className="text-slate-400 dark:text-slate-500 italic font-sans">
                      —
                    </span>
                  )}
                </div>
                <div className="md:col-span-2 min-w-0">
                  {p ? (
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 min-w-0">
                      <Avatar name={p.name} url={p.avatar_url} size="sm" />
                      <span className="truncate">{p.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                      Unassigned
                    </span>
                  )}
                </div>
                <div className="md:col-span-2 text-sm text-slate-600 dark:text-slate-300">
                  {a.purchased_on ?? (
                    <span className="text-slate-400 dark:text-slate-500 italic">—</span>
                  )}
                </div>
                <div className="md:col-span-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 justify-end">
                  <button
                    onClick={() => setEditing(a)}
                    className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white p-1"
                    aria-label="Edit asset"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${a.name}"?`)) {
                        startTransition(() => deleteAsset(a.id));
                      }
                    }}
                    className="text-slate-400 dark:text-slate-500 hover:text-rose-600 p-1"
                    aria-label="Delete asset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <Modal title="Add asset" onClose={() => setShowNew(false)}>
          <AssetForm
            profiles={profiles}
            onSubmit={async (input) => {
              await createAsset(input);
              setShowNew(false);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit asset" onClose={() => setEditing(null)}>
          <AssetForm
            initial={editing}
            profiles={profiles}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              await updateAsset(editing.id, input);
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function AssetForm({
  initial,
  profiles,
  submitLabel,
  onSubmit,
}: {
  initial?: Asset;
  profiles: Profile[];
  submitLabel?: string;
  onSubmit: (input: AssetInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Laptop");
  const [serial, setSerial] = useState(initial?.serial ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assigned_to ?? "");
  const [purchasedOn, setPurchasedOn] = useState(initial?.purchased_on ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      await onSubmit({
        name: name.trim(),
        category: category.trim() || "other",
        serial: serial.trim(),
        assigned_to: assignedTo || null,
        purchased_on: purchasedOn || null,
        notes: notes.trim(),
      });
    });
  }

  const input =
    "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-slate-300";

  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">Name</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. MacBook Pro 16, Sony A7IV"
        className={input + " mb-3"}
      />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Laptop, Camera, Mic…"
            className={input}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Serial / tag</label>
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Optional"
            className={input}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">Assigned to</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className={input}
          >
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Purchased on</label>
          <input
            type="date"
            value={purchasedOn}
            onChange={(e) => setPurchasedOn(e.target.value)}
            className={input}
          />
        </div>
      </div>
      <label className="text-sm font-medium block mb-1.5">Notes (optional)</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Where it lives, condition, warranty…"
        rows={3}
        className={input + " mb-4 resize-none"}
      />
      <button
        onClick={submit}
        disabled={pending || !name.trim()}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel ?? "Add asset"}
      </button>
    </div>
  );
}

// ── SOPs ──────────────────────────────────────────────────────────────────

function SopsPanel({ sops }: { sops: Sop[] }) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Sop | null>(null);
  const [opened, setOpened] = useState<Sop | null>(null);
  const [, startTransition] = useTransition();

  // Group by category.
  const byCategory = new Map<string, Sop[]>();
  sops.forEach((s) => {
    const cat = s.category || "Uncategorised";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(s);
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold">SOPs</h3>
        <button
          onClick={() => setShowNew(true)}
          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" /> New SOP
        </button>
      </div>
      {sops.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic px-5 py-8 text-center">
          No SOPs yet — start documenting the way we work.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {Array.from(byCategory.entries()).map(([cat, list]) => (
            <div key={cat}>
              <div className="px-5 py-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium bg-slate-50 dark:bg-slate-800/40">
                {cat}
              </div>
              {list.map((s) => (
                <div
                  key={s.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 group"
                >
                  <button
                    onClick={() => setOpened(s)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="font-medium truncate">{s.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {s.body
                        ? s.body.replace(/\s+/g, " ").slice(0, 100)
                        : "Empty SOP — click to add content"}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => setEditing(s)}
                      className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white p-1"
                      aria-label="Edit SOP"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${s.title}"?`)) {
                          startTransition(() => deleteSop(s.id));
                        }
                      }}
                      className="text-slate-400 dark:text-slate-500 hover:text-rose-600 p-1"
                      aria-label="Delete SOP"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <Modal title="New SOP" onClose={() => setShowNew(false)}>
          <SopForm
            onSubmit={async (input) => {
              await createSop(input);
              setShowNew(false);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit "${editing.title}"`} onClose={() => setEditing(null)}>
          <SopForm
            initial={editing}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              await updateSop(editing.id, input);
              setEditing(null);
            }}
          />
        </Modal>
      )}
      {opened && (
        <Modal title={opened.title} onClose={() => setOpened(null)}>
          <div className="max-h-[70vh] overflow-y-auto">
            {opened.category && (
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                {opened.category}
              </div>
            )}
            <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {opened.body || (
                <span className="italic text-slate-400 dark:text-slate-500">
                  This SOP is empty.
                </span>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setEditing(opened);
                  setOpened(null);
                }}
                className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SopForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Sop;
  submitLabel?: string;
  onSubmit: (input: SopInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!title.trim()) return;
    startTransition(async () => {
      await onSubmit({ title: title.trim(), category: category.trim(), body });
    });
  }

  const input =
    "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-slate-300";

  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">Title</label>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. How we onboard a new client"
        className={input + " mb-3"}
      />
      <label className="text-sm font-medium block mb-1.5">Category</label>
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Onboarding, Editing, Posting…"
        className={input + " mb-3"}
      />
      <label className="text-sm font-medium block mb-1.5">Body</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Steps, links, examples…"
        rows={10}
        className={input + " mb-4 resize-y min-h-[200px]"}
      />
      <button
        onClick={submit}
        disabled={pending || !title.trim()}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel ?? "Add SOP"}
      </button>
    </div>
  );
}

// ── Vault links ──────────────────────────────────────────────────────────

function VaultPanel({ links }: { links: VaultLink[] }) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<VaultLink | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h3 className="font-semibold">Vault links</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Labels and links to entries in your real password manager —{" "}
            <strong>not</strong> the passwords themselves.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 hover:bg-slate-800 flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Add link
        </button>
      </div>
      {links.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic px-5 py-8 text-center">
          No vault links yet. Paste links to 1Password, Bitwarden, or shared
          credentials.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {links.map((v) => (
            <div
              key={v.id}
              className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 group"
            >
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium truncate">{v.label}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                </div>
                {v.notes && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {v.notes}
                  </div>
                )}
              </a>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => setEditing(v)}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white p-1"
                  aria-label="Edit link"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${v.label}"?`)) {
                      startTransition(() => deleteVaultLink(v.id));
                    }
                  }}
                  className="text-slate-400 dark:text-slate-500 hover:text-rose-600 p-1"
                  aria-label="Delete link"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <Modal title="Add vault link" onClose={() => setShowNew(false)}>
          <VaultForm
            onSubmit={async (input) => {
              await createVaultLink(input);
              setShowNew(false);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit vault link" onClose={() => setEditing(null)}>
          <VaultForm
            initial={editing}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              await updateVaultLink(editing.id, input);
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function VaultForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: VaultLink;
  submitLabel?: string;
  onSubmit: (input: VaultLinkInput) => Promise<void>;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!label.trim() || !url.trim()) return;
    startTransition(async () => {
      await onSubmit({ label: label.trim(), url: url.trim(), notes: notes.trim() });
    });
  }

  const input =
    "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-slate-300";

  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">Label</label>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Gmail (info@…), Canva team, Resend"
        className={input + " mb-3"}
      />
      <label className="text-sm font-medium block mb-1.5">URL</label>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://share.1password.com/…"
        className={input + " mb-3"}
      />
      <label className="text-sm font-medium block mb-1.5">Notes (optional)</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Who can use it, scope, expiry…"
        rows={3}
        className={input + " mb-4 resize-none"}
      />
      <button
        onClick={submit}
        disabled={pending || !label.trim() || !url.trim()}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel ?? "Add link"}
      </button>
    </div>
  );
}

// ── HR / Team ─────────────────────────────────────────────────────────────

function HrPanel({ profiles }: { profiles: Profile[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">HR / Team</h3>
        <Link
          href="/team"
          className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
        >
          Open Team page <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
      {profiles.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic">
          No team members yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {profiles.map((p) => (
            <Link
              key={p.id}
              href="/team"
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 min-w-0"
            >
              <Avatar name={p.name} url={p.avatar_url} size="md" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {p.email}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        Want leave tracking, salary register, or onboarding checklists slotted
        in here? Tell me which to build first.
      </p>
    </div>
  );
}
