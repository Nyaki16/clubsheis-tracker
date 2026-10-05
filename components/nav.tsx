"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  CalendarDays,
  CopyMinus,
  Download,
  House,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  ScrollText,
  Sparkles,
  SquareKanban,
  Star,
  Sun,
  Tag,
  User as UserIcon,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useTheme, type Theme } from "@/components/theme";
import Avatar from "@/components/avatar";

const GROUPS = [
  {
    label: "Work",
    items: [
      { href: "/home", label: "Home", icon: House },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/debbie", label: "Ask Debbie", icon: Sparkles },
      { href: "/meetings", label: "Meetings", icon: BookOpen },
    ],
  },
  {
    label: "Studio",
    quiet: true,
    items: [
      { href: "/daily", label: "Daily Scroll", icon: ScrollText },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pipeline", label: "Pipeline", icon: SquareKanban },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/team", label: "Team", icon: UsersRound },
      { href: "/csi-home", label: "CSI Home", icon: Star },
    ],
  },
  {
    label: "Settings",
    quiet: true,
    items: [
      { href: "/settings/templates", label: "Package templates", icon: Layers },
      { href: "/settings/pricing", label: "Pricing", icon: Tag },
      { href: "/settings/calendar", label: "Calendar sync", icon: CalendarDays },
      { href: "/settings/import", label: "Import from Client Flow", icon: Download },
      { href: "/settings/duplicates", label: "Duplicates", icon: CopyMinus },
    ],
  },
];

export default function Nav({
  profile,
}: {
  profile: { name: string; email: string; avatar_url?: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  // Close the phone menu after navigating.
  const [navFrom, setNavFrom] = useState(pathname);
  if (pathname !== navFrom) {
    setNavFrom(pathname);
    setMobileOpen(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const brand = (
    <Link href="/home" className="flex items-center gap-3 shrink-0 px-2">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold">
        CS
      </div>
      <div>
        <p className="font-semibold text-base leading-tight">ClubSheIs</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">Tracker</p>
      </div>
    </Link>
  );

  const links = (
    <div className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <nav key={g.label} aria-label={g.label} className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
            {g.label}
          </p>
          {g.items.map((v) => {
            const active = pathname === v.href || pathname.startsWith(v.href + "/");
            const Icon = v.icon;
            return (
              <Link
                key={v.href}
                href={v.href}
                className={`flex items-center gap-2.5 px-2.5 rounded-md transition ${g.quiet ? "py-1.5 text-[13px]" : "py-2 text-sm font-medium"} ${
                  active
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {v.label}
              </Link>
            );
          })}
        </nav>
      ))}
    </div>
  );

  const account = (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
        aria-label="Account menu"
      >
        <Avatar name={profile.name} url={profile.avatar_url} size="md" />
        <span className="min-w-0">
          <span className="block text-sm font-medium truncate">{profile.name}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{profile.email}</span>
        </span>
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg p-2 z-40">
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md flex items-center gap-2"
            >
              <UserIcon className="w-4 h-4" /> Profile
            </Link>
            <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 mt-1">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium mb-1.5">Theme</p>
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
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col gap-6 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-5 z-20 overflow-y-auto">
        {brand}
        {links}
        <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-800">{account}</div>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="lg:hidden sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        {brand}
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 px-3 py-5 flex flex-col gap-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              {brand}
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            {links}
            <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-800">{account}</div>
          </div>
        </div>
      )}
    </>
  );
}
