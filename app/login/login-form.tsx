"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "register";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "confirm" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (mode === "register" && !name.trim()) {
      setError("Please add your name.");
      setStatus("error");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setError("");

    const supabase = createClient();

    if (mode === "register") {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) {
        setStatus("error");
        setError(authError.message);
        return;
      }
      if (data.session) {
        router.replace("/daily");
        router.refresh();
        return;
      }
      // Email confirmation required
      setStatus("confirm");
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setStatus("error");
      setError(authError.message);
      return;
    }
    router.replace("/daily");
    router.refresh();
  }

  if (status === "confirm") {
    return (
      <div className="text-sm text-slate-700">
        <p className="font-medium mb-1">Almost done.</p>
        <p className="text-slate-500">
          We sent a confirmation link to <strong>{email}</strong>. Click it once, then come back and sign in.
        </p>
      </div>
    );
  }

  const submitting = status === "submitting";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {mode === "register" && (
        <div>
          <label className="text-sm font-medium block mb-1.5">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nyaki"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
          />
        </div>
      )}
      <div>
        <label className="text-sm font-medium block mb-1.5">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-60"
      >
        {submitting ? (mode === "register" ? "Creating account…" : "Signing in…") : (mode === "register" ? "Create account" : "Sign in")}
      </button>
      {error && (
        <p className="text-sm text-rose-600 mt-2">{error}</p>
      )}
      <div className="text-center text-sm text-slate-500 pt-1">
        {mode === "signin" ? (
          <>
            New here?{" "}
            <button
              type="button"
              onClick={() => { setMode("register"); setError(""); setStatus("idle"); }}
              className="text-slate-900 font-medium hover:underline"
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(""); setStatus("idle"); }}
              className="text-slate-900 font-medium hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </form>
  );
}
