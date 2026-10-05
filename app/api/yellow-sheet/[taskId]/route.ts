import { createAdminClient } from "@/lib/supabase/admin";
import { YS_FIELDS, countWords } from "@/lib/yellow-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: the client submits their Yellow Sheet. The link is the task's id;
// only Yellow Sheet tasks accept answers, and only the known fields are kept.
export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Something went wrong sending your answers. Please try again." }, { status: 400 });

  const answers: Record<string, string> = {};
  for (const f of YS_FIELDS) {
    const v = body[f.key];
    if (typeof v === "string") answers[f.key] = v.slice(0, 8000);
  }
  if (!answers.phone?.trim() || !answers.email?.trim()) {
    return Response.json({ error: "Please add your phone number and business email before sending." }, { status: 400 });
  }
  const short = YS_FIELDS.find((f) => f.minWords && countWords(answers[f.key] ?? "") < f.minWords);
  if (short) {
    return Response.json({ error: `“${short.label}” needs at least ${short.minWords} words. The more detail you give us, the better your copy.` }, { status: 400 });
  }
  if (!answers.business?.trim() || !answers.offer?.trim()) {
    return Response.json({ error: "Please tell us about your business and your offer before sending." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: task } = await supabase.from("tasks").select("id, tool, tool_state").eq("id", taskId).maybeSingle();
  if (!task || task.tool !== "yellow") return Response.json({ error: "This link isn't valid. Please ask ClubSheIs for a new one." }, { status: 404 });

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "closed_out",
      tool_state: { ...(task.tool_state ?? {}), ...answers, state: "submitted", submitted_at: new Date().toISOString(), submitted_by: "client" },
    })
    .eq("id", taskId);
  if (error) return Response.json({ error: "We couldn't save your answers. Please try again." }, { status: 500 });
  return Response.json({ ok: true });
}
