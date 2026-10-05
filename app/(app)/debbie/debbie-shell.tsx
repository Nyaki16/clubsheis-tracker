"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Sparkles } from "lucide-react";
import DebbieChat, { DebbieAvatar, type ChatMessage } from "@/components/debbie/debbie-chat";

export default function DebbieShell({
  chats,
  chatId,
  messages,
  recommendedThisWeek,
  meetingCount,
}: {
  chats: { id: string; title: string; updated_at: string }[];
  chatId: string | null;
  messages: ChatMessage[];
  recommendedThisWeek: number;
  meetingCount: number;
}) {
  const router = useRouter();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 h-[calc(100vh-8rem)] min-h-[560px]">
      <aside className="hidden lg:flex flex-col gap-4 min-h-0">
        <div className="flex items-center gap-2.5">
          <DebbieAvatar size={36} />
          <div>
            <h1 className="font-bold leading-tight">Ask Debbie</h1>
            <p className="text-xs text-slate-500">{meetingCount} meetings in memory</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-xs">
          <Link href="/meetings" className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
            <BookOpen className="w-3.5 h-3.5" /> Meetings library
          </Link>
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
            <Sparkles className="w-3.5 h-3.5" /> {recommendedThisWeek} Debbie Recommends task{recommendedThisWeek === 1 ? "" : "s"} this week
          </div>
        </div>
        <div className="flex flex-col gap-0.5 min-h-0 overflow-y-auto">
          <p className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400 px-2 pb-1">Your chats</p>
          <button
            onClick={() => router.push("/debbie")}
            className={`text-left text-sm px-2 py-1.5 rounded-md ${!chatId ? "bg-slate-100 dark:bg-slate-800 font-medium" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
          >
            + New chat
          </button>
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/debbie?chat=${c.id}`)}
              className={`text-left text-sm px-2 py-1.5 rounded-md truncate ${c.id === chatId ? "bg-slate-100 dark:bg-slate-800 font-medium" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </aside>
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 sm:px-6 pb-4 flex flex-col min-h-0">
        <DebbieChat
          chatId={chatId}
          initialMessages={messages}
          onChatChange={(id) => router.replace(id ? `/debbie?chat=${id}` : "/debbie", { scroll: false })}
        />
      </section>
    </div>
  );
}
