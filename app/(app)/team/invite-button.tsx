"use client";

import { useState, useTransition } from "react";
import { Copy, Plus } from "lucide-react";
import Modal from "@/components/modal";
import { generateInviteLink, inviteUser } from "@/app/actions/users";

export default function InviteButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-slate-800"
      >
        <Plus className="w-4 h-4" /> Add user
      </button>
      {open && (
        <Modal title="Invite a teammate" onClose={() => setOpen(false)}>
          <InviteForm onDone={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  function submitEmail() {
    if (!name.trim() || !email.trim()) return;
    setError("");
    setSuccess("");
    setLink("");
    startTransition(async () => {
      const res = await inviteUser(name, email);
      if (res.ok) {
        setSuccess(res.message);
        setName("");
        setEmail("");
        setTimeout(onDone, 1500);
      } else {
        setError(res.message);
      }
    });
  }

  function submitLink() {
    if (!name.trim() || !email.trim()) return;
    setError("");
    setSuccess("");
    setLink("");
    setCopied(false);
    startTransition(async () => {
      const res = await generateInviteLink(name, email);
      if (res.ok) {
        setLink(res.link);
        setSuccess(
          `Link generated for ${res.email}. Copy it and DM it to them.`
        );
      } else {
        setError(res.message);
      }
    });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">Name</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Kopano"
        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300"
      />
      <label className="text-sm font-medium block mb-1.5">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="they@example.com"
        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300"
        onKeyDown={(e) => e.key === "Enter" && submitEmail()}
      />
      <button
        onClick={submitEmail}
        disabled={pending || !name.trim() || !email.trim()}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Working…" : "Send invite email"}
      </button>
      <div className="flex items-center gap-2 my-3 text-xs text-slate-400 dark:text-slate-500">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        or
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      </div>
      <button
        onClick={submitLink}
        disabled={pending || !name.trim() || !email.trim()}
        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-lg font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Working…" : "Generate invite link (no email)"}
      </button>

      {link && (
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
            One-time invite link
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900 font-mono truncate"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-1 text-xs bg-slate-900 text-white px-2 py-1.5 rounded hover:bg-slate-800"
            >
              <Copy className="w-3 h-3" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            DM this to them. It logs them in and lets them set a password.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
      {success && !link && (
        <p className="text-sm text-emerald-600 mt-3">{success}</p>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
        They&apos;ll set their own password from the email or link.
      </p>
    </div>
  );
}
