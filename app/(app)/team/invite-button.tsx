"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import Modal from "@/components/modal";
import { inviteUser } from "@/app/actions/users";

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

  function submit() {
    if (!name.trim() || !email.trim()) return;
    setError("");
    setSuccess("");
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

  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">Name</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Kopano"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-slate-900"
      />
      <label className="text-sm font-medium block mb-1.5">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="they@example.com"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-slate-900"
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <button
        onClick={submit}
        disabled={pending || !name.trim() || !email.trim()}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Sending invite…" : "Send invite"}
      </button>
      {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
      {success && <p className="text-sm text-emerald-600 mt-3">{success}</p>}
      <p className="text-xs text-slate-400 mt-3">
        They&apos;ll get an email with a link to set their password.
      </p>
    </div>
  );
}
