import { createClient } from "@/lib/supabase/server";
import { askDebbie } from "@/lib/debbie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sse = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

// Ask Debbie: streams her progress ("Searching meetings for …") then the answer.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Debbie needs ANTHROPIC_API_KEY on the Tracker." }, { status: 500 });

  const { chatId: givenId, message } = (await req.json()) as { chatId?: string; message: string };
  const text = (message ?? "").trim();
  if (!text) return Response.json({ error: "Ask Debbie something." }, { status: 400 });

  const { data: me } = await supabase.from("profiles").select("name").eq("id", auth.user.id).single();
  let chatId = givenId ?? "";
  if (!chatId) {
    const { data: chat, error } = await supabase
      .from("debbie_chats")
      .insert({ user_id: auth.user.id, title: text.slice(0, 70) })
      .select("id")
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    chatId = chat.id;
  }
  const { data: prior } = await supabase.from("debbie_messages").select("role, text").eq("chat_id", chatId).order("created_at").limit(40);
  await supabase.from("debbie_messages").insert({ chat_id: chatId, role: "user", text, content: [{ type: "text", text }] });
  const history = [...((prior ?? []) as { role: "user" | "assistant"; text: string }[]), { role: "user" as const, text }];

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(sse(o)));
      send({ type: "chat", chatId });
      try {
        const answer = await askDebbie(supabase, history, me?.name ?? "a teammate", (e) => send(e));
        await supabase.from("debbie_messages").insert({ chat_id: chatId, role: "assistant", text: answer, content: [{ type: "text", text: answer }] });
        await supabase.from("debbie_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
        send({ type: "done" });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Debbie couldn't answer that." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
