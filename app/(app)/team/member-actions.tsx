"use client";

import { useState, useTransition } from "react";
import { Mail, Shield, ShieldOff } from "lucide-react";
import { reinviteUser, setIsAdmin } from "@/app/actions/users";

export default function MemberActions({
  profileId,
  isAdminUser,
  isSelf,
}: {
  profileId: string;
  isAdminUser: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function resend() {
    setMsg(null);
    startTransition(async () => {
      const res = await reinviteUser(profileId);
      setMsg({ kind: res.ok ? "ok" : "err", text: res.message });
    });
  }

  function toggleAdmin() {
    const next = !isAdminUser;
    if (!next && !confirm("Remove admin access for this person?")) return;
    setMsg(null);
    startTransition(async () => {
      const res = await setIsAdmin(profileId, next);
      setMsg({ kind: res.ok ? "ok" : "err", text: res.message });
    });
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={resend}
          disabled={pending}
          className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
        >
          <Mail className="w-3 h-3" />
          Resend login link
        </button>
        {!isSelf && (
          <button
            onClick={toggleAdmin}
            disabled={pending}
            className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
          >
            {isAdminUser ? (
              <>
                <ShieldOff className="w-3 h-3" /> Remove admin
              </>
            ) : (
              <>
                <Shield className="w-3 h-3" /> Make admin
              </>
            )}
          </button>
        )}
      </div>
      {msg && (
        <p
          className={`text-xs mt-2 ${
            msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
