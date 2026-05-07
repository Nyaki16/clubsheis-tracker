"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

const VIEWS = [
  { href: "/daily", label: "Daily Scroll" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/team", label: "Team" },
];

export default function Nav({ profile }: { profile: { name: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/daily" className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold">
            CS
          </div>
          <div className="hidden sm:block">
            <h1 className="font-semibold text-base leading-tight">ClubSheIs</h1>
            <p className="text-xs text-slate-500 leading-tight">Production Tracker</p>
          </div>
        </Link>

        <div className="flex items-center gap-1 flex-wrap justify-end">
          {VIEWS.map((v) => {
            const active = pathname === v.href || pathname.startsWith(v.href + "/");
            return (
              <Link
                key={v.href}
                href={v.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {v.label}
              </Link>
            );
          })}

          <div className="relative ml-2">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold text-sm flex items-center justify-center"
              aria-label="User menu"
            >
              {profile.name?.[0]?.toUpperCase() ?? "?"}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg border border-slate-200 shadow-lg p-2 z-20">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-sm font-medium truncate">{profile.name}</p>
                    <p className="text-xs text-slate-500 truncate">{profile.email}</p>
                  </div>
                  <button
                    onClick={signOut}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
