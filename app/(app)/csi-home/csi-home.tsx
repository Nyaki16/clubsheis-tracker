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
  LeaveRequest,
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
  pendingLeave,
  viewer,
}: {
  assets: Asset[];
  sops: Sop[];
  vaultLinks: VaultLink[];
  profiles: Profile[];
  pendingLeave: LeaveRequest[];
  viewer: { id: string; isAdmin: boolean };
}) {
  const [tab, setTab] = useState<Tab>("assets");

  const hrCount = viewer.isAdmin ? profiles.length : 1;
  const tabs: { id: Tab; label: string; count: number; Icon: typeof Laptop }[] = [
    { id: "assets", label: "Asset Register", count: assets.length, Icon: Laptop },
    { id: "sops", label: "SOPs", count: sops.length, Icon: BookOpen },
    { id: "vault", label: "Vault links", count: vaultLinks.length, Icon: KeyRound },
    { id: "hr", label: "HR / Team", count: hrCount, Icon: Users },
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
      {tab === "hr" && (
        <HrPanel profiles={profiles} pendingLeave={pendingLeave} viewer={viewer} />
      )}
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
        <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
          <div className="hidden md:grid grid-cols-[2fr_2fr_1.5fr_1fr_1.5fr_1.5fr_1.5fr_auto] gap-3 px-5 py-2 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium bg-slate-50 dark:bg-slate-800/40 min-w-[1100px]">
            <div>Device Owner</div>
            <div>Model</div>
            <div>Processor</div>
            <div>Memory</div>
            <div>Serial Number</div>
            <div>OS</div>
            <div>Graphics</div>
            <div className="w-16" />
          </div>
          {assets.map((a) => {
            const p = a.assigned_to ? profilesById.get(a.assigned_to) : null;
            return (
              <div
                key={a.id}
                className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.5fr_1fr_1.5fr_1.5fr_1.5fr_auto] gap-3 px-5 py-3 group items-center hover:bg-slate-50 dark:hover:bg-slate-800 min-w-[1100px]"
              >
                <div className="min-w-0">
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
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {a.model ?? a.name}
                  </div>
                  {a.category && a.category !== "other" && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {a.category}
                    </div>
                  )}
                </div>
                <Cell value={a.processor} />
                <Cell value={a.memory} />
                <Cell value={a.serial} mono />
                <Cell value={a.os} />
                <Cell value={a.graphics} />
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 justify-end w-16">
                  <button
                    onClick={() => setEditing(a)}
                    className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white p-1"
                    aria-label="Edit asset"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${a.model ?? a.name}"?`)) {
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
  const [model, setModel] = useState(initial?.model ?? initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Laptop");
  const [processor, setProcessor] = useState(initial?.processor ?? "");
  const [memory, setMemory] = useState(initial?.memory ?? "");
  const [serial, setSerial] = useState(initial?.serial ?? "");
  const [os, setOs] = useState(initial?.os ?? "");
  const [graphics, setGraphics] = useState(initial?.graphics ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assigned_to ?? "");
  const [purchasedOn, setPurchasedOn] = useState(initial?.purchased_on ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmedModel = model.trim();
    if (!trimmedModel) return;
    startTransition(async () => {
      await onSubmit({
        // The DB still requires `name` — mirror Model into it so existing
        // queries keep working, while the UI treats Model as primary.
        name: trimmedModel,
        category: category.trim() || "other",
        serial: serial.trim(),
        assigned_to: assignedTo || null,
        purchased_on: purchasedOn || null,
        notes: notes.trim(),
        model: trimmedModel,
        processor: processor.trim() || null,
        memory: memory.trim() || null,
        os: os.trim() || null,
        graphics: graphics.trim() || null,
      });
    });
  }

  const input =
    "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-slate-300";

  return (
    <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">Model</label>
          <input
            autoFocus
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. MacBook Pro 16 (M2 Pro, 2023)"
            className={input}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Laptop, Camera, Mic…"
            className={input}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">Device owner</label>
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
          <label className="text-sm font-medium block mb-1.5">Serial number</label>
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="C02XXXXXX"
            className={input}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">Processor</label>
          <input
            value={processor}
            onChange={(e) => setProcessor(e.target.value)}
            placeholder="Apple M2 Pro 12-core"
            className={input}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Memory</label>
          <input
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
            placeholder="32 GB"
            className={input}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">OS</label>
          <input
            value={os}
            onChange={(e) => setOs(e.target.value)}
            placeholder="macOS Sonoma 14.5"
            className={input}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Graphics</label>
          <input
            value={graphics}
            onChange={(e) => setGraphics(e.target.value)}
            placeholder="19-core GPU"
            className={input}
          />
        </div>
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

      <div>
        <label className="text-sm font-medium block mb-1.5">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Where it lives, condition, warranty…"
          rows={3}
          className={input + " resize-none"}
        />
      </div>

      <button
        onClick={submit}
        disabled={pending || !model.trim()}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel ?? "Add asset"}
      </button>
    </div>
  );
}

function Cell({ value, mono = false }: { value: string | null; mono?: boolean }) {
  return (
    <div
      className={`text-sm text-slate-600 dark:text-slate-300 truncate ${
        mono ? "font-mono" : ""
      }`}
    >
      {value || (
        <span className="text-slate-400 dark:text-slate-500 italic font-sans">
          —
        </span>
      )}
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
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{s.title}</span>
                      {s.url && (
                        <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {s.body
                        ? s.body.replace(/\s+/g, " ").slice(0, 100)
                        : s.url
                        ? s.url
                        : "Empty SOP — click to add content"}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white p-1"
                        aria-label="Open SOP link"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
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
            {opened.url && (
              <a
                href={opened.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-md mb-3"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open document
              </a>
            )}
            <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {opened.body || (
                <span className="italic text-slate-400 dark:text-slate-500">
                  {opened.url
                    ? "Body is empty — content lives in the linked document above."
                    : "This SOP is empty."}
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
  const [url, setUrl] = useState(initial?.url ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!title.trim()) return;
    startTransition(async () => {
      await onSubmit({
        title: title.trim(),
        category: category.trim(),
        body,
        url: url.trim() || null,
      });
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
      <label className="text-sm font-medium block mb-1.5">
        URL <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
      </label>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://docs.google.com/… or https://notion.so/…"
        className={input + " mb-3"}
      />
      <label className="text-sm font-medium block mb-1.5">Body</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Steps, links, examples… (or leave blank if everything's in the linked doc)"
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

function HrPanel({
  profiles,
  pendingLeave,
  viewer,
}: {
  profiles: Profile[];
  pendingLeave: LeaveRequest[];
  viewer: { id: string; isAdmin: boolean };
}) {
  // Non-admins only see themselves; admins see everyone.
  const visible = viewer.isAdmin
    ? profiles
    : profiles.filter((p) => p.id === viewer.id);
  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      {viewer.isAdmin && pendingLeave.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2 text-sm">
            {pendingLeave.length} leave request
            {pendingLeave.length === 1 ? "" : "s"} waiting on you
          </h3>
          <div className="space-y-1.5">
            {pendingLeave.map((l) => {
              const p = profilesById.get(l.requester_id);
              return (
                <Link
                  key={l.id}
                  href={`/csi-home/team/${l.requester_id}`}
                  className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200 hover:underline"
                >
                  <span className="font-medium">{p?.name ?? "Someone"}</span>
                  <span className="text-xs">
                    · {l.start_date}
                    {l.end_date !== l.start_date ? ` → ${l.end_date}` : ""} ·{" "}
                    {Number(l.days)} {Number(l.days) === 1 ? "day" : "days"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">
            {viewer.isAdmin ? "Team" : "Your profile"}
          </h3>
          {viewer.isAdmin && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Click a name to view & edit
            </span>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic">
            No team members yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visible.map((p) => (
              <Link
                key={p.id}
                href={`/csi-home/team/${p.id}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 min-w-0"
              >
                <Avatar name={p.name} url={p.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate flex items-center gap-2">
                    {p.name}
                    {p.surname ? ` ${p.surname}` : ""}
                    {p.is_admin && (
                      <span className="text-[9px] uppercase tracking-wide bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-1 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {p.job_title ?? p.email}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
