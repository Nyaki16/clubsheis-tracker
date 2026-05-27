"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import type { Profile } from "@/lib/types";
import {
  updateMyPassword,
  updateMyProfile,
  uploadMyAvatar,
} from "@/app/actions/users";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export default function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Name
  const [name, setName] = useState(profile.name);
  const [savingName, startSavingName] = useTransition();
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  // Password
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, startSavingPw] = useTransition();
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function saveName() {
    setNameMsg(null);
    startSavingName(async () => {
      const res = await updateMyProfile({ name });
      setNameMsg({ ok: res.ok, text: res.message });
      if (res.ok) router.refresh();
    });
  }

  async function uploadAvatar(file: File) {
    setAvatarMsg(null);
    if (file.size > MAX_BYTES) {
      setAvatarMsg({ ok: false, text: "File is bigger than 5 MB." });
      return;
    }
    if (!file.type.startsWith("image/")) {
      setAvatarMsg({ ok: false, text: "Pick an image file." });
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadMyAvatar(fd);
      if (!res.ok) throw new Error(res.message);
      // Server returns the public URL in res.message on success.
      setAvatarUrl(res.message);
      setAvatarMsg({ ok: true, text: "Photo updated." });
      router.refresh();
    } catch (e) {
      setAvatarMsg({
        ok: false,
        text: e instanceof Error ? e.message : "Upload failed.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setAvatarMsg(null);
    setUploading(true);
    try {
      const res = await updateMyProfile({ avatar_url: null });
      if (!res.ok) throw new Error(res.message);
      setAvatarUrl(null);
      setAvatarMsg({ ok: true, text: "Photo removed." });
      router.refresh();
    } catch (e) {
      setAvatarMsg({
        ok: false,
        text: e instanceof Error ? e.message : "Could not remove.",
      });
    } finally {
      setUploading(false);
    }
  }

  function savePassword() {
    setPwMsg(null);
    if (pw !== pw2) {
      setPwMsg({ ok: false, text: "Passwords don't match." });
      return;
    }
    startSavingPw(async () => {
      const res = await updateMyPassword(pw);
      setPwMsg({ ok: res.ok, text: res.message });
      if (res.ok) {
        setPw("");
        setPw2("");
      }
    });
  }

  const input =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900";

  return (
    <div className="space-y-8">
      {/* Avatar */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold mb-3">Profile picture</h3>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={profile.name}
              className="w-20 h-20 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold text-xl flex items-center justify-center">
              {profile.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
            </button>
            {avatarUrl && (
              <button
                onClick={removeAvatar}
                disabled={uploading}
                className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1.5 disabled:opacity-60"
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">JPG or PNG, up to 5 MB.</p>
        {avatarMsg && (
          <p
            className={`text-sm mt-3 ${
              avatarMsg.ok ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {avatarMsg.text}
          </p>
        )}
      </section>

      {/* Name */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold mb-3">Name</h3>
        <label className="text-sm font-medium block mb-1.5">Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={input + " mb-3"}
        />
        <label className="text-sm font-medium block mb-1.5">Email</label>
        <input value={profile.email} disabled className={input + " bg-slate-50"} />
        <p className="text-xs text-slate-400 mt-1.5 mb-4">
          Email can&apos;t be changed here — ask an admin if you need to update it.
        </p>
        <button
          onClick={saveName}
          disabled={savingName || !name.trim() || name === profile.name}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
        >
          {savingName ? "Saving…" : "Save name"}
        </button>
        {nameMsg && (
          <p
            className={`text-sm mt-3 ${
              nameMsg.ok ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {nameMsg.text}
          </p>
        )}
      </section>

      {/* Password */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold mb-1">Password</h3>
        <p className="text-xs text-slate-500 mb-4">
          Set a new password. You don&apos;t need to enter the old one — your
          current session is the proof.
        </p>
        <label className="text-sm font-medium block mb-1.5">New password</label>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="At least 8 characters"
          className={input + " mb-3"}
        />
        <label className="text-sm font-medium block mb-1.5">Confirm new password</label>
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className={input + " mb-4"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && pw && pw === pw2) savePassword();
          }}
        />
        <button
          onClick={savePassword}
          disabled={savingPw || !pw || pw.length < 8 || pw !== pw2}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
        >
          {savingPw ? "Saving…" : "Change password"}
        </button>
        {pwMsg && (
          <p
            className={`text-sm mt-3 ${
              pwMsg.ok ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {pwMsg.text}
          </p>
        )}
      </section>
    </div>
  );
}
