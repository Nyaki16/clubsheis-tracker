"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Maximize2, X } from "lucide-react";
import DebbieChat, { DebbieAvatar } from "./debbie-chat";

// The "Ask Debbie" button on every page, opening a chat panel.
export default function DebbieLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  if (pathname.startsWith("/debbie")) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl text-sm font-semibold"
        >
          <DebbieAvatar size={30} /> Ask Debbie
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[420px] sm:h-[min(640px,calc(100vh-2.5rem))] bg-white dark:bg-slate-900 sm:border border-slate-200 dark:border-slate-700 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <DebbieAvatar />
            <span className="font-semibold text-sm flex-1">Ask Debbie</span>
            <Link href={chatId ? `/debbie?chat=${chatId}` : "/debbie"} onClick={() => setOpen(false)} aria-label="Open full page" className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white">
              <Maximize2 className="w-4 h-4" />
            </Link>
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <DebbieChat chatId={chatId} onChatChange={setChatId} compact />
          </div>
        </div>
      )}
    </>
  );
}
