import { createClient } from "@/lib/supabase/server";
import DebbieShell from "./debbie-shell";

const weekAgo = () => new Date(Date.now() - 7 * 864e5).toISOString();

export default async function DebbiePage({ searchParams }: { searchParams: Promise<{ chat?: string }> }) {
  const { chat } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const [{ data: chats }, { data: messages }, { count: recommended }, { count: meetings }] = await Promise.all([
    supabase.from("debbie_chats").select("id, title, updated_at").eq("user_id", auth.user?.id ?? "").order("updated_at", { ascending: false }).limit(40),
    chat
      ? supabase.from("debbie_messages").select("role, text").eq("chat_id", chat).order("created_at")
      : Promise.resolve({ data: [] as { role: "user" | "assistant"; text: string }[] }),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("debbie_recommended", true).gte("created_at", weekAgo()),
    supabase.from("meetings").select("*", { count: "exact", head: true }).neq("notes", ""),
  ]);
  return (
    <DebbieShell
      chats={chats ?? []}
      chatId={chat ?? null}
      messages={(messages ?? []) as { role: "user" | "assistant"; text: string }[]}
      recommendedThisWeek={recommended ?? 0}
      meetingCount={meetings ?? 0}
    />
  );
}
