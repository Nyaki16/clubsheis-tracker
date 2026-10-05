import { createClient } from "@/lib/supabase/server";
import { loadProposalContext, proposalFilename, type ProposalState } from "@/lib/proposal-server";
import { buildProposalPdf } from "@/lib/proposal-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const supabase = await createClient();
  const ctx = await loadProposalContext(supabase, taskId);
  if (!ctx) return new Response("Proposal not found.", { status: 404 });

  const data = (ctx.task.tool_state as ProposalState).data;
  if (!data) return new Response("No proposal generated yet for this client.", { status: 404 });

  const dateLabel = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  const pdf = await buildProposalPdf(data, ctx.client.name, ctx.client.business_name, dateLabel);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${proposalFilename(ctx.client)}"`,
      "Cache-Control": "no-store",
    },
  });
}
