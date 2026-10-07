// Debbie's weekly briefing for the team: where we are against target, what's
// at risk, what to focus on. Written on Monday mornings (by the 10-minute
// background run) or on demand from the dashboard. Server-only.
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { briefingFacts, loadDashboard } from "./dashboard";

export type Briefing = { weekStart: string; content: string; created_at: string };

function mondayOf(d: Date) {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m.toISOString().slice(0, 10);
}

export async function latestBriefing(sb: SupabaseClient): Promise<Briefing | null> {
  const { data } = await sb.from("app_settings").select("value").eq("key", "weekly_briefing").maybeSingle();
  return (data?.value as Briefing | undefined) ?? null;
}

export async function writeWeeklyBriefing(sb: SupabaseClient): Promise<Briefing> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY isn't set on the Tracker.");
  const d = await loadDashboard(sb);
  const { data: scrolls } = await sb
    .from("meetings")
    .select("title, starts_at, notes")
    .eq("kind", "team_scroll")
    .neq("notes", "")
    .order("starts_at", { ascending: false })
    .limit(3);
  const scrollText = (scrolls ?? [])
    .map((m) => `--- ${m.title} (${String(m.starts_at).slice(0, 10)})\n${String(m.notes).slice(0, 6000)}`)
    .join("\n\n");

  const anthropic = new Anthropic();
  const msg = await anthropic.beta.messages
    .stream({
      model: "claude-sonnet-5-5",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: `You are Debbie, the ClubSheIs team's memory and cheerleader. Every Monday you write the team a short briefing. ClubSheIs is a small South African digital marketing agency; the team is Gizelle (client lead), Mpume (page builds), Xoli (video and content) and Nyaki (quality and founder).`,
      messages: [
        {
          role: "user",
          content: `Write this week's team briefing from these facts.

FACTS FROM THE TRACKER
${briefingFacts(d)}

RECENT TEAM SCROLL NOTES
${scrollText || "None."}

FORMAT (Markdown, about 180 to 260 words):
## The number
One or two sentences: new paying clients this month against the target of ${d.target}, whether we're on pace, and the forecast. Say plainly how many more we need.
## Wins to celebrate
Two to four bullets, naming people and clients. Give real credit.
## This week's focus
Three bullets, the most important things to move: deals to chase, bottlenecks to clear, who should do what. Be specific.
## Watch out
One or two bullets on risks (overdue work, clients waiting, stalled flows). Skip this section if there's nothing real.

RULES: Warm, direct and motivating, like a good team lead. Only use the facts above; never invent numbers or names. No money or revenue figures. South African English. Output only the briefing.`,
        },
      ],
    })
    .finalMessage();
  const content = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  if (!content) throw new Error("Debbie's briefing came back empty. Try again.");
  const briefing: Briefing = { weekStart: mondayOf(new Date()), content, created_at: new Date().toISOString() };
  const { error } = await sb.from("app_settings").upsert({ key: "weekly_briefing", value: briefing, updated_at: briefing.created_at });
  if (error) throw new Error(error.message);
  return briefing;
}

/** For the background run: write Monday's briefing once, from 07:00 SAST. */
export async function maybeWriteWeeklyBriefing(sb: SupabaseClient) {
  const sast = new Date(Date.now() + 2 * 3600e3);
  if (sast.getUTCDay() !== 1 || sast.getUTCHours() < 7) return;
  const current = await latestBriefing(sb);
  if (current?.weekStart === mondayOf(new Date())) return;
  await writeWeeklyBriefing(sb);
}
