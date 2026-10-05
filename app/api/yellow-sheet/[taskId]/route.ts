import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateClientDocs } from "@/lib/client-docs";
import { YS_FIELDS, countWords } from "@/lib/yellow-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rewriting the Client Profile after a submission runs in the background (after()).
export const maxDuration = 300;

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
  const { data: task } = await supabase.from("tasks").select("id, job_id, tool, tool_state").eq("id", taskId).maybeSingle();
  if (!task || task.tool !== "yellow") return Response.json({ error: "This link isn't valid. Please ask ClubSheIs for a new one." }, { status: 404 });

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "closed_out",
      tool_state: { ...(task.tool_state ?? {}), ...answers, state: "submitted", submitted_at: new Date().toISOString(), submitted_by: "client" },
    })
    .eq("id", taskId);
  if (error) return Response.json({ error: "We couldn't save your answers. Please try again." }, { status: 500 });

  // Bring the client's record up to date with what they told us, then have
  // Debbie rewrite their Client Profile and Strategy Brief with it.
  const { data: job } = await supabase.from("jobs").select("client_id").eq("id", task.job_id).single();
  const clientId = job?.client_id as string | undefined;
  if (clientId) {
    const { data: client } = await supabase.from("clients").select("email, phone, business_name, website_url").eq("id", clientId).single();
    const v = (k: string) => answers[k]?.trim() ?? "";
    const patch: Record<string, string> = { docs_dirty_at: new Date().toISOString() };
    // Their own business name and website win; contact details only fill gaps,
    // so the email and number the team already uses don't change under them.
    if (v("business_name")) patch.business_name = v("business_name");
    if (v("website")) patch.website_url = v("website");
    if (v("email") && !client?.email) patch.email = v("email");
    if (v("phone") && !client?.phone) patch.phone = v("phone");
    await supabase.from("clients").update(patch).eq("id", clientId);
    for (const p of [`/clients/${clientId}`, "/clients", "/home"]) revalidatePath(p);

    after(async () => {
      try {
        await updateClientDocs(supabase, clientId, "their Yellow Sheet");
      } catch {
        // Left marked for the next background run, which retries it.
      }
    });
  }
  return Response.json({ ok: true });
}
