import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { loadProposalContext, proposalPrompt, type ProposalState } from "@/lib/proposal-server";
import { PROPOSAL_JSON_SCHEMA, type PricingCard, type ProposalData } from "@/lib/proposal-template";
import type { PricingTier } from "@/lib/flow";
import { yellowSheetText } from "@/lib/yellow-sheet";

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

  const { taskId, notes, cards } = (await req.json()) as { taskId: string; notes?: string; cards?: PricingCard[] };
  const ctx = await loadProposalContext(supabase, taskId);
  if (!ctx) return Response.json({ error: "Proposal task not found." }, { status: 404 });


  const { data: tierRows } = await supabase.from("pricing_tiers").select("*").order("position");
  const tiers = (tierRows ?? []) as PricingTier[];
  // Anything else said with this client since (or besides) the discovery call.
  const { data: links } = await supabase.from("meeting_clients").select("meetings(title, starts_at, notes)").eq("client_id", ctx.client.id);
  const transcript = String(ctx.discovery?.tool_state?.transcript ?? "").trim();
  const meetings = ((links ?? []) as unknown as { meetings: { title: string; starts_at: string | null; notes: string } | null }[])
    .map((l) => l.meetings)
    .filter((m): m is { title: string; starts_at: string | null; notes: string } => !!m && !!m.notes.trim() && m.notes.trim() !== transcript)
    .sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""))
    .slice(0, 4)
    .map((m) => ({ title: m.title, date: m.starts_at, notes: m.notes }));
  const fixed = (cards ?? []).filter((c) => c.name?.trim() || c.price?.trim());

  // Everything else we know about them: Gemini notes saved on the client, the
  // Yellow Sheet if they've filled it in, and Debbie's Client Profile.
  const callNotes = String(ctx.client.call_notes ?? "").trim();
  const ys = ctx.siblings.find((t) => t.tool === "yellow");
  const yellowSheet = ys ? yellowSheetText(ys.tool_state) : "";
  const { data: profileDoc } = await supabase
    .from("client_documents")
    .select("content")
    .eq("client_id", ctx.client.id)
    .eq("kind", "profile")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const profile = String(profileDoc?.content ?? "").trim();

  // A proposal is only as specific as what the client told us. Without real
  // notes the model can only write generic copy, so stop and say what's missing.
  const words = (t: unknown) => String(t ?? "").split(/\s+/).filter(Boolean).length;
  const dts = ctx.discovery?.tool_state ?? {};
  const material =
    words(dts.need) +
    words(transcript || callNotes) +
    words(ctx.client.call_message) +
    words(yellowSheet) +
    meetings.reduce((n, m) => n + words(m.notes), 0) +
    words(notes) +
    words(ctx.task.notes);
  if (material < 150) {
    const first = ctx.client.name.split(" ")[0];
    const why = transcript || callNotes ? "" : " Gemini didn't take notes on this call, so nothing came in automatically.";
    return Response.json(
      {
        error: `There's too little from the call to write a specific proposal (${material} words of notes).${why} Paste the transcript or your notes from the call into Discovery call + notes, with what ${first} sells, who to, what they've tried and what they want, then generate again.`,
      },
      { status: 422 }
    );
  }

  const prompt = proposalPrompt({
    client: ctx.client,
    discovery: ctx.discovery,
    tiers,
    notes,
    cards: fixed,
    taskNotes: ctx.task.notes,
    meetings,
    callNotes: transcript ? "" : callNotes,
    yellowSheet,
    profile,
  });

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
        // The team's pricing is final: keep their names, prices and terms exactly.
        if (fixed.length) {
          data.cards = fixed.map((f, i) => ({
            ...(data.cards[i] ?? { eyebrow: "", subtitle: "", features: [] }),
            name: f.name,
            price: f.price,
            cadence: f.cadence,
            totalNote: f.totalNote,
          }));
        }

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
