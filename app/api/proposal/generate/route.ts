import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { loadProposalContext, proposalPrompt, type ProposalState } from "@/lib/proposal-server";
import { PROPOSAL_JSON_SCHEMA, type ProposalData } from "@/lib/proposal-template";
import type { PricingTier } from "@/lib/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A proposal takes a minute or two to write. Node functions stream fine and
// aren't bound by the Edge 25s first-byte limit the old app had to work around.
export const maxDuration = 300;

const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sign in to generate proposals." }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Proposal generation isn't set up yet: add ANTHROPIC_API_KEY to the Tracker's Vercel environment variables." },
      { status: 500 }
    );
  }

  const { taskId, notes } = (await req.json()) as { taskId: string; notes?: string };
  const ctx = await loadProposalContext(supabase, taskId);
  if (!ctx) return Response.json({ error: "Proposal task not found." }, { status: 404 });

  const dts = ctx.discovery?.tool_state ?? {};
  if (!dts.need && !dts.transcript && !ctx.client.call_message) {
    return Response.json({ error: "Add the discovery call notes first." }, { status: 400 });
  }

  const { data: tierRows } = await supabase.from("pricing_tiers").select("*").order("position");
  const tiers = (tierRows ?? []) as PricingTier[];
  const prompt = proposalPrompt({ client: ctx.client, discovery: ctx.discovery, tiers, notes });

  const save = async (patch: ProposalState, status?: string) => {
    const payload: Record<string, unknown> = { tool_state: { ...(ctx.task.tool_state ?? {}), ...patch } };
    if (status) payload.status = status;
    await supabase.from("tasks").update(payload).eq("id", taskId);
  };

  const anthropic = new Anthropic();
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sse(obj)));
      try {
        const stream = anthropic.beta.messages.stream({
          model: "claude-sonnet-5-5",
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          output_config: {
            effort: "medium",
            format: { type: "json_schema", schema: PROPOSAL_JSON_SCHEMA as unknown as Record<string, unknown> },
          },
          // Re-run on Anthropic's recommended fallback model if a safety
          // classifier declines the request.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          messages: [{ role: "user", content: prompt }],
        });

        let chars = 0;
        let lastSent = 0;
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            chars += event.delta.text.length;
            if (chars - lastSent > 400) {
              lastSent = chars;
              send({ type: "progress", chars });
            }
          }
        }

        const message = await stream.finalMessage();
        if (message.stop_reason === "refusal") {
          throw new Error("Claude declined to write this proposal. Check the discovery notes and try again.");
        }
        if (message.stop_reason === "max_tokens") {
          throw new Error("The proposal came back cut off. Try again.");
        }
        const text = message.content
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("");
        const data = JSON.parse(text) as ProposalData;

        await save(
          { state: "ready", data, notes: notes ?? "", email_body: null, generated_at: new Date().toISOString(), error: undefined },
          "in_review"
        );
        send({ type: "done", data });
      } catch (err) {
        const msg =
          err instanceof Anthropic.APIError
            ? `Claude API error ${err.status ?? ""}: ${err.message}`
            : err instanceof Error
            ? err.message
            : "Something went wrong writing the proposal.";
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
