import { createClient } from "@/lib/supabase/server";
import { emailHtml, sendGmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Plain email from the team (e.g. the "not a fit" thank-you).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sign in to send email." }, { status: 401 });

  const { to, subject, body } = (await req.json()) as { to: string; subject: string; body: string };
  if (!to?.trim() || !subject?.trim() || !body?.trim()) {
    return Response.json({ error: "Add an email address, a subject and the message." }, { status: 400 });
  }
  try {
    await sendGmail({ to: to.trim(), subject: subject.trim(), text: body, html: emailHtml(body) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't send the email." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
