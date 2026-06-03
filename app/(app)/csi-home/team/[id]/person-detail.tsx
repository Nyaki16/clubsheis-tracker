"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  FileText,
  Loader2,
  Pencil,
  ShieldCheck,
  Mail as MailIcon,
  Trash2,
  X,
} from "lucide-react";
import Modal from "@/components/modal";
import Avatar from "@/components/avatar";
import type { LeaveRequest, LeaveStatus, Profile } from "@/lib/types";
import {
  cancelLeaveRequest,
  createLeaveRequest,
  decideLeaveRequest,
  reinviteUser,
  setIsAdmin,
  updateProfileFields,
  uploadIdDocument,
} from "@/app/actions/users";

type Viewer = { id: string; isAdmin: boolean; isSelf: boolean };

const STATUS_COLOR: Record<LeaveStatus, string> = {
  pending:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  approved:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  rejected:
    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  cancelled:
    "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

function ymd(s: string | null) {
  return s ?? "";
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
}

export default function PersonDetail({
  profile,
  leave,
  viewer,
}: {
  profile: Profile;
  leave: LeaveRequest[];
  viewer: Viewer;
}) {
  const router = useRouter();
  const canEdit = viewer.isAdmin || viewer.isSelf;
  const isAdminViewing = viewer.isAdmin && !viewer.isSelf;

  const [editing, setEditing] = useState(false);
  const [requestingLeave, setRequestingLeave] = useState(false);
  const [decision, setDecision] = useState<{
    leave: LeaveRequest;
    next: "approved" | "rejected";
  } | null>(null);

  // Leave taken this calendar year (approved only).
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const approvedThisYear = leave.filter(
    (l) => l.status === "approved" && l.start_date >= yearStart
  );
  const takenDays = approvedThisYear.reduce((s, l) => s + Number(l.days), 0);
  const allowance = profile.annual_leave_allowance ?? 20;
  const remaining = Math.max(0, allowance - takenDays);

  return (
    <div className="space-y-6">
      <Link
        href="/csi-home"
        className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      >
        ← CSI Home
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-start gap-4">
          <Avatar name={profile.name} url={profile.avatar_url} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold leading-tight">
                {profile.name}
                {profile.surname ? ` ${profile.surname}` : ""}
              </h2>
              {profile.is_admin && (
                <span className="text-[10px] uppercase tracking-wide bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-1.5 py-0.5 rounded">
                  Admin
                </span>
              )}
            </div>
            {profile.job_title && (
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                {profile.job_title}
              </p>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {profile.email}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>

        {isAdminViewing && (
          <AdminActions
            profileId={profile.id}
            isCurrentlyAdmin={profile.is_admin}
          />
        )}
      </div>

      {/* Personal info */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="font-semibold mb-4">Personal info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="Cellphone" value={profile.cellphone} />
          <Field label="Start date" value={profile.start_date} />
          <Field
            label="Home address"
            value={profile.home_address}
            full
          />
          <Field label="Next of kin" value={profile.next_of_kin} />
          <Field label="Next of kin phone" value={profile.next_of_kin_phone} />
          <Field
            label="ID document"
            value={
              profile.id_document_url ? (
                <a
                  href={profile.id_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-200 hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" /> View document
                </a>
              ) : null
            }
            raw
          />
        </div>
      </div>

      {/* Leave */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold">Leave</h3>
          {canEdit && (
            <button
              onClick={() => setRequestingLeave(true)}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800"
            >
              {viewer.isSelf ? "Request leave" : "File leave"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <Stat label="Allowance" value={allowance} />
          <Stat label="Taken this year" value={takenDays} valueClass="text-amber-600" />
          <Stat label="Remaining" value={remaining} valueClass="text-emerald-600" />
        </div>

        <h4 className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium mb-2">
          Requests
        </h4>

        {leave.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic">
            No leave requests yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 -mx-5 border-t border-slate-100 dark:border-slate-800">
            {leave.map((l) => {
              const isPending = l.status === "pending";
              return (
                <div
                  key={l.id}
                  className="px-5 py-3 flex items-start gap-3 flex-wrap"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {l.start_date}
                        {l.end_date !== l.start_date ? ` → ${l.end_date}` : ""}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({Number(l.days)} {Number(l.days) === 1 ? "day" : "days"})
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border font-medium ${
                          STATUS_COLOR[l.status]
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>
                    {l.reason && (
                      <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        {l.reason}
                      </div>
                    )}
                    {l.decided_notes && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                        Note: {l.decided_notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {viewer.isAdmin && isPending && (
                      <>
                        <button
                          onClick={() => setDecision({ leave: l, next: "approved" })}
                          className="text-xs px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setDecision({ leave: l, next: "rejected" })}
                          className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {viewer.isSelf && isPending && (
                      <CancelButton id={l.id} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <Modal title="Edit personal info" onClose={() => setEditing(false)}>
          <PersonalInfoForm
            profile={profile}
            isAdmin={viewer.isAdmin}
            onDone={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        </Modal>
      )}

      {requestingLeave && (
        <Modal
          title={viewer.isSelf ? "Request leave" : `File leave for ${profile.name}`}
          onClose={() => setRequestingLeave(false)}
        >
          <LeaveRequestForm
            requesterId={profile.id}
            onDone={() => {
              setRequestingLeave(false);
              router.refresh();
            }}
          />
        </Modal>
      )}

      {decision && (
        <Modal
          title={
            decision.next === "approved" ? "Approve leave" : "Reject leave"
          }
          onClose={() => setDecision(null)}
        >
          <DecisionForm
            request={decision.leave}
            decision={decision.next}
            onDone={() => {
              setDecision(null);
              router.refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  full = false,
  raw = false,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
  raw?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium mb-0.5">
        {label}
      </div>
      <div className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
        {value ? (
          raw ? (
            value
          ) : (
            <span>{value}</span>
          )
        ) : (
          <span className="text-slate-400 dark:text-slate-500 italic">—</span>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3 py-2">
      <div className={`text-xl font-bold ${valueClass ?? ""}`}>{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

// ── Admin actions on the header ──────────────────────────────────────────

function AdminActions({
  profileId,
  isCurrentlyAdmin,
}: {
  profileId: string;
  isCurrentlyAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function reinvite() {
    setMsg(null);
    startTransition(async () => {
      const res = await reinviteUser(profileId);
      setMsg(res.message);
      if (res.ok) router.refresh();
    });
  }
  function toggleAdmin() {
    setMsg(null);
    startTransition(async () => {
      const res = await setIsAdmin(profileId, !isCurrentlyAdmin);
      setMsg(res.message);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
      <button
        onClick={reinvite}
        disabled={pending}
        className="text-xs px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 disabled:opacity-60"
      >
        <MailIcon className="w-3.5 h-3.5" /> Resend login link
      </button>
      <button
        onClick={toggleAdmin}
        disabled={pending}
        className="text-xs px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 disabled:opacity-60"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        {isCurrentlyAdmin ? "Demote from admin" : "Make admin"}
      </button>
      {msg && (
        <span className="text-xs text-slate-500 dark:text-slate-400">{msg}</span>
      )}
    </div>
  );
}

// ── Personal info form ──────────────────────────────────────────────────

function PersonalInfoForm({
  profile,
  isAdmin,
  onDone,
}: {
  profile: Profile;
  isAdmin: boolean;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.name);
  const [surname, setSurname] = useState(profile.surname ?? "");
  const [cellphone, setCellphone] = useState(profile.cellphone ?? "");
  const [homeAddress, setHomeAddress] = useState(profile.home_address ?? "");
  const [nextOfKin, setNextOfKin] = useState(profile.next_of_kin ?? "");
  const [nokPhone, setNokPhone] = useState(profile.next_of_kin_phone ?? "");
  const [jobTitle, setJobTitle] = useState(profile.job_title ?? "");
  const [startDate, setStartDate] = useState(profile.start_date ?? "");
  const [allowance, setAllowance] = useState(
    String(profile.annual_leave_allowance ?? 20)
  );
  const [idUrl, setIdUrl] = useState(profile.id_document_url);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  function save() {
    setMsg(null);
    startSaving(async () => {
      const res = await updateProfileFields(profile.id, {
        name,
        surname,
        cellphone,
        home_address: homeAddress,
        next_of_kin: nextOfKin,
        next_of_kin_phone: nokPhone,
        job_title: jobTitle,
        start_date: startDate || null,
        ...(isAdmin ? { annual_leave_allowance: Number(allowance) } : {}),
      });
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) setTimeout(onDone, 600);
    });
  }

  async function pickFile(file: File) {
    setMsg(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadIdDocument(profile.id, fd);
      if (!res.ok) throw new Error(res.message);
      setIdUrl(res.message);
      setMsg({ ok: true, text: "ID uploaded." });
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof Error ? e.message : "Upload failed.",
      });
    } finally {
      setUploading(false);
    }
  }

  const input =
    "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-slate-300";

  return (
    <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">First name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Surname</label>
          <input
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            className={input}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">Cellphone</label>
          <input
            value={cellphone}
            onChange={(e) => setCellphone(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Job title</label>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className={input}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1.5">Home address</label>
        <textarea
          value={homeAddress}
          onChange={(e) => setHomeAddress(e.target.value)}
          rows={2}
          className={input + " resize-none"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">Next of kin</label>
          <input
            value={nextOfKin}
            onChange={(e) => setNextOfKin(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">
            Next of kin phone
          </label>
          <input
            value={nokPhone}
            onChange={(e) => setNokPhone(e.target.value)}
            className={input}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">Start date</label>
          <input
            type="date"
            value={ymd(startDate)}
            onChange={(e) => setStartDate(e.target.value)}
            className={input}
          />
        </div>
        {isAdmin && (
          <div>
            <label className="text-sm font-medium block mb-1.5">
              Annual leave allowance (days)
            </label>
            <input
              type="number"
              min={0}
              value={allowance}
              onChange={(e) => setAllowance(e.target.value)}
              className={input}
            />
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium block mb-1.5">
          ID document <span className="text-slate-400 font-normal">(JPG, PNG, PDF)</span>
        </label>
        <div className="flex items-center gap-3">
          {idUrl ? (
            <a
              href={idUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200 hover:underline"
            >
              <FileText className="w-4 h-4" /> View current
            </a>
          ) : (
            <span className="text-sm text-slate-400 italic">No file yet</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            {idUrl ? "Replace" : "Upload"}
          </button>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving || !name.trim()}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60 mt-2"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
      {msg && (
        <p
          className={`text-sm ${
            msg.ok ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

// ── Leave request form ─────────────────────────────────────────────────

function LeaveRequestForm({
  requesterId,
  onDone,
}: {
  requesterId?: string;
  onDone: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const computedDays = start && end ? daysBetween(start, end) : 0;
  const [daysOverride, setDaysOverride] = useState<string>("");
  const days = daysOverride
    ? Number(daysOverride)
    : computedDays;

  function submit() {
    setMsg(null);
    if (!start || !end || days <= 0) {
      setMsg({ ok: false, text: "Pick valid dates." });
      return;
    }
    startTransition(async () => {
      const res = await createLeaveRequest(
        {
          start_date: start,
          end_date: end,
          days,
          reason,
        },
        requesterId
      );
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) setTimeout(onDone, 600);
    });
  }

  const input =
    "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-slate-300";

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">From</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">To</label>
          <input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
            className={input}
          />
        </div>
      </div>
      <label className="text-sm font-medium block mb-1.5">
        Days to deduct{" "}
        <span className="text-slate-400 font-normal">
          (auto = {computedDays || 0})
        </span>
      </label>
      <input
        type="number"
        min={0.5}
        step={0.5}
        value={daysOverride}
        placeholder={String(computedDays || "")}
        onChange={(e) => setDaysOverride(e.target.value)}
        className={input + " mb-3"}
      />
      <label className="text-sm font-medium block mb-1.5">Reason (optional)</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="e.g. Family trip, medical appointment…"
        className={input + " mb-4 resize-none"}
      />
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Sent to admins (Nyaki / Kopano) for approval.
      </p>
      <button
        onClick={submit}
        disabled={pending || !start || !end}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send for approval"}
      </button>
      {msg && (
        <p
          className={`text-sm mt-3 ${
            msg.ok ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

// ── Decision form (admin only) ─────────────────────────────────────────

function DecisionForm({
  request,
  decision,
  onDone,
}: {
  request: LeaveRequest;
  decision: "approved" | "rejected";
  onDone: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit() {
    setMsg(null);
    startTransition(async () => {
      const res = await decideLeaveRequest(request.id, decision, notes);
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) setTimeout(onDone, 600);
    });
  }

  const isApprove = decision === "approved";
  const input =
    "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-slate-300";

  return (
    <div>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
        {request.start_date}
        {request.end_date !== request.start_date && ` → ${request.end_date}`}{" "}
        · {Number(request.days)} days
      </p>
      <label className="text-sm font-medium block mb-1.5">
        Note to requester (optional)
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder={isApprove ? "Have a good break!" : "Reason for rejection…"}
        className={input + " mb-4 resize-none"}
      />
      <button
        onClick={submit}
        disabled={pending}
        className={`w-full text-white py-2 rounded-lg font-medium text-sm disabled:opacity-60 ${
          isApprove ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
        }`}
      >
        {pending ? "Saving…" : isApprove ? "Approve leave" : "Reject leave"}
      </button>
      {msg && (
        <p
          className={`text-sm mt-3 ${
            msg.ok ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

function CancelButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Cancel this leave request?")) return;
        startTransition(async () => {
          await cancelLeaveRequest(id);
          router.refresh();
        });
      }}
      disabled={pending}
      className="text-xs px-2 py-1 rounded text-slate-500 dark:text-slate-400 hover:text-rose-600 flex items-center gap-1 disabled:opacity-60"
    >
      <X className="w-3 h-3" /> Cancel
    </button>
  );
}
