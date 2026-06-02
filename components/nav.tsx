"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Monitor, Moon, Sun, User as UserIcon } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme";

const VIEWS = [
  { href: "/daily", label: "Daily Scroll" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/calendar", label: "Calendar" },
  { href: "/team", label: "Team" },
  { href: "/csi-home", label: "CSI Home" },
];

export default function Nav({
  profile,
}: {
  profile: { name: string; email: string; avatar_url?: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/daily" className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold">
            CS
          </div>
          <div className="hidden sm:block">
            <h1 className="font-semibold text-base leading-tight">ClubSheIs</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">Production Tracker</p>
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
                  active ? "bg-slate-900 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                {v.label}
              </Link>
            );
          })}

          <div className="relative ml-2">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold text-sm flex items-center justify-center"
              aria-label="User menu"
            >
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                profile.name?.[0]?.toUpperCase() ?? "?"
              )}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg p-2 z-20">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-sm font-medium truncate">{profile.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{profile.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md flex items-center gap-2"
                  >
                    <UserIcon className="w-4 h-4" /> Profile
                  </Link>

                  <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 mt-1">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium mb-1.5">
                      Theme
                    </p>
                    <div className="inline-flex w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-0.5">
                      {(["light", "system", "dark"] as Theme[]).map((t) => {
                        const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
                        const active = theme === t;
                        return (
                          <button
                            key={t}
                            onClick={() => setTheme(t)}
                            className={`flex-1 flex items-center justify-center text-xs px-2 py-1 rounded ${
                              active
                                ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-100"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            }`}
                            aria-label={`${t} theme`}
                            title={t === "system" ? "Match system" : t}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={signOut}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md flex items-center gap-2"
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
