import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { loadProposalContext } from "@/lib/proposal-server";
import { generatorFor } from "@/lib/generators";
import { yellowSheetText } from "@/lib/yellow-sheet";
import { isDone, packageLabel } from "@/lib/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Plain text of a live page, for the internal check.
async function pageText(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: "follow", headers: { "User-Agent": "ClubSheIs-QA/1.0" } });
    if (!res.ok) return `[Could not fetch: HTTP ${res.status}. Review manually.]`;
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  } catch {
    return "[Could not fetch (timeout or login required). Review manually.]";
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sign in to generate." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Generation isn't set up yet: add ANTHROPIC_API_KEY to the Tracker's Vercel environment variables." },
      { status: 500 }
    );
  }

  const { notes } = (await req.json().catch(() => ({}))) as { notes?: string };
  const ctx = await loadProposalContext(supabase, taskId);
  if (!ctx) return Response.json({ error: "Task not found." }, { status: 404 });
  const spec = generatorFor(ctx.task.title);
  if (!spec) return Response.json({ error: `There's no generator for "${ctx.task.title}". Rename the task to match one, or write it by hand.` }, { status: 400 });

  const { client, siblings, task } = ctx;
  const yellow = siblings.find((t) => t.tool === "yellow");
  const discovery = siblings.find((t) => t.tool === "discovery");
  const ys = yellowSheetText(yellow?.tool_state);

  const parts: string[] = [
    `CLIENT: ${client.name}${client.business_name ? ` (${client.business_name})` : ""}`,
    `PACKAGE: ${packageLabel(client.package)}`,
  ];
  if (client.website_url) parts.push(`WEBSITE: ${client.website_url}`);
  if (ys) parts.push(`=== YELLOW SHEET (from the client) ===\n${ys}`);
  else {
    const d = discovery?.tool_state ?? {};
    const call = [str(d.need), str(d.transcript), client.call_message ?? ""].filter(Boolean).join("\n\n");
    parts.push(
      call
        ? `=== NO YELLOW SHEET YET — DISCOVERY CALL NOTES INSTEAD ===\n${call.slice(0, 15000)}`
        : "=== NO YELLOW SHEET OR CALL NOTES YET === Write the strongest generic version and mark every assumption as [GAP]."
    );
  }
  for (const title of spec.uses) {
    const src = siblings.find((t) => t.title === title);
    const text = str(src?.tool_state?.text);
    if (text) {
      const approved = src?.tool_state?.state === "approved" || (src && isDone(src));
      parts.push(`=== ${approved ? "APPROVED" : "DRAFT"} ${title.toUpperCase()} ===\n${text.slice(0, 30000)}`);
    }
  }
  if (spec.usesLinks) {
    const links = str(task.tool_state?.links)
      .split(/\s+/)
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, 15);
    if (task.title === "Internal check") {
      if (links.length) {
        const pages = await Promise.all(links.map(async (u) => `--- ${u} ---\n${await pageText(u)}`));
        parts.push(`=== LIVE PAGE CONTENT ===\n${pages.join("\n\n")}`);
      } else parts.push("=== LIVE PAGE CONTENT ===\nNo live page links were provided.");
    } else {
      parts.push(`=== ACCESS LINKS ===\n${links.length ? links.join("\n") : "None provided yet."}`);
      const built = siblings.filter((t) => isDone(t) && t.phase === "production").map((t) => `- ${t.title}`);
      if (built.length) parts.push(`=== DELIVERABLES COMPLETED ===\n${built.join("\n")}`);
      parts.push(`DATE: ${new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}`);
    }
  }
  if (notes?.trim()) parts.push(`=== NOTES FROM THE TEAM FOR THIS DRAFT ===\n${notes.trim()}`);

  const anthropic = new Anthropic();
  const encoder = new TextEncoder();
  const prior = task.tool_state ?? {};

  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sse(obj)));
      try {
        const stream = anthropic.beta.messages.stream({
          model: "claude-sonnet-5-5",
          max_tokens: spec.maxTokens,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: spec.prompt,
          messages: [{ role: "user", content: parts.join("\n\n") }],
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ type: "delta", text: event.delta.text });
          }
        }
        const message = await stream.finalMessage();
        if (message.stop_reason === "refusal") throw new Error("Claude declined to write this. Adjust the inputs and try again.");
        const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
        if (!text) throw new Error("Nothing came back. Try again.");
        const truncated = message.stop_reason === "max_tokens";

        await supabase
          .from("tasks")
          .update({
            status: "in_review",
            tool_state: { ...prior, state: "draft", text, notes: notes ?? "", generated_at: new Date().toISOString(), doc_url: null, truncated },
          })
          .eq("id", taskId);
        send({ type: "done", truncated });
      } catch (err) {
        const msg =
          err instanceof Anthropic.APIError
            ? err.status === 429
              ? "Too many generations at once. Wait a moment and try again."
              : `Claude API error ${err.status ?? ""}: ${err.message}`
            : err instanceof Error
            ? err.message
            : "Something went wrong.";
        send({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
