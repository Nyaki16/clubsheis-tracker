"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "reset";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setSubmitting(false);
      setError(authError.message);
      return;
    }
    router.replace("/daily");
    router.refresh();
  }

  async function onSendReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/welcome`,
      }
    );
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setResetSent(false);
    setPassword("");
  }

  if (mode === "reset") {
    return (
      <form onSubmit={onSendReset} className="space-y-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-slate-300"
            disabled={resetSent}
          />
        </div>
        {!resetSent ? (
          <>
            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
            {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
          </>
        ) : (
          <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Check your email — we sent a link to set a new password.
          </p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-2">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="hover:text-slate-600 underline-offset-2 hover:underline"
          >
            ← Back to sign in
          </button>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={onSignIn} className="space-y-3">
      <div>
        <label className="text-sm font-medium block mb-1.5">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-slate-300"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium">Password</label>
          <button
            type="button"
            onClick={() => switchMode("reset")}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline-offset-2 hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="current-password"
          className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-slate-300"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
      <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-2">
        New here? Ask an admin to invite you.
      </p>
    </form>
  );
}
