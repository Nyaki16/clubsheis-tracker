import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@/lib/supabase/server";
import { loadProposalContext, proposalFilename, type ProposalState } from "@/lib/proposal-server";
import { buildProposalPdf } from "@/lib/proposal-pdf";
import { PUBLIC_APP_URL, emailHtml, sendGmail, type Attachment } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sign in to send proposals." }, { status: 401 });

  const { to, subject, body } = (await req.json()) as { to: string; subject: string; body: string };
  if (!to?.trim() || !subject?.trim() || !body?.trim()) {
    return Response.json({ error: "Add the client's email, a subject and the message." }, { status: 400 });
  }

  const ctx = await loadProposalContext(supabase, taskId);
  if (!ctx) return Response.json({ error: "Proposal not found." }, { status: 404 });
  const ts = ctx.task.tool_state as ProposalState;
  if (!ts.data) return Response.json({ error: "Generate the proposal first." }, { status: 400 });

  try {
    const dateLabel = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
    const attachments: Attachment[] = [
      { filename: proposalFilename(ctx.client), content: await buildProposalPdf(ts.data, ctx.client.name, ctx.client.business_name, dateLabel) },
    ];
    try {
      attachments.push({ filename: "ClubSheIs-About-Us.pdf", content: readFileSync(join(process.cwd(), "public", "ClubSheIs-About-Us.pdf")) });
    } catch {
      // Send without it rather than failing the whole email.
    }

    await sendGmail({
      to: to.trim(),
      subject: subject.trim(),
      text: body,
      html: emailHtml(body, `${PUBLIC_APP_URL}/api/track/${taskId}`),
      attachments,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't send the email." }, { status: 500 });
  }

  const sentAt = new Date().toISOString();
  await supabase
    .from("tasks")
    .update({ status: "closed_out", tool_state: { ...ts, state: "sent", sent_at: sentAt, sent_to: to.trim(), email_body: body, opened_at: null } })
    .eq("id", taskId);

  // The follow-up waits on the client now.
  const followUp = ctx.siblings.find((t) => t.title === "Follow up on proposal");
  if (followUp && followUp.status !== "closed_out" && followUp.status !== "published") {
    const due = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    await supabase.from("tasks").update({ status: "awaiting_client", due_date: due }).eq("id", followUp.id);
  }
  if (!ctx.client.email) await supabase.from("clients").update({ email: to.trim() }).eq("id", ctx.client.id);

  return Response.json({ ok: true, sent_at: sentAt });
}
