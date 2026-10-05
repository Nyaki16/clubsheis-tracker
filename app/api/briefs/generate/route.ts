import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { briefPrompt, gatherBriefSources, wordCount, type BriefRequest } from "@/lib/briefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sign in to write briefs." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY isn't set on the Tracker." }, { status: 500 });
  }

  const body = (await req.json()) as BriefRequest;
  if (!body.title?.trim()) return Response.json({ error: "Name the project first, e.g. “Sales page build”." }, { status: 400 });

  let input: Awaited<ReturnType<typeof gatherBriefSources>>;
  try {
    input = await gatherBriefSources(supabase, { ...body, meetingIds: body.meetingIds ?? [], links: body.links ?? [] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't read the notes." }, { status: 400 });
  }
  const words = input.sources.reduce((n, s) => n + wordCount(s.text), 0);
  if (words < 80) {
    return Response.json(
      { error: `There's too little to brief from (${words} words of notes). Tick the meetings or discovery call it's based on, add a link, or paste the notes.` },
      { status: 422 }
    );
  }
  const prompt = briefPrompt(input, body);
  const sources = input.sources.map((s) => s.label);

  const anthropic = new Anthropic();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sse(obj)));
      try {
        const s = anthropic.beta.messages.stream({
          model: "claude-sonnet-5-5",
          max_tokens: 8000,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          messages: [{ role: "user", content: prompt }],
        });
        let chars = 0;
        let lastSent = 0;
        for await (const event of s) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            chars += event.delta.text.length;
            if (chars - lastSent > 300) {
              lastSent = chars;
              send({ type: "progress", chars });
            }
          }
        }
        const message = await s.finalMessage();
        if (message.stop_reason === "refusal") throw new Error("Claude declined to write this brief. Check the notes and try again.");
        const content = message.content
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("")
          .trim();
        if (!content) throw new Error("The brief came back empty. Try again.");

        const now = new Date().toISOString();
        let id = body.briefId ?? null;
        if (id) {
          const { error } = await supabase
            .from("project_briefs")
            .update({ title: body.title.trim(), content, sources, updated_by: auth.user.id, updated_at: now })
            .eq("id", id);
          if (error) throw new Error(error.message);
        } else {
          const { data, error } = await supabase
            .from("project_briefs")
            .insert({ client_id: body.clientId, title: body.title.trim(), content, sources, created_by: auth.user.id, updated_by: auth.user.id })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          id = data.id as string;
        }
        send({ type: "done", id });
      } catch (err) {
        const msg =
          err instanceof Anthropic.APIError ? `Claude API error ${err.status ?? ""}: ${err.message}` : err instanceof Error ? err.message : "Couldn't write the brief.";
        send({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
