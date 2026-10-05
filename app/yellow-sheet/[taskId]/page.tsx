import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import YellowSheetForm from "./yellow-sheet-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Yellow Sheet · ClubSheIs", robots: { index: false } };

// Public page: the link we send a client once they've paid for Ghutte.
export default async function YellowSheetPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) notFound();

  const supabase = createAdminClient();
  const { data: task } = await supabase.from("tasks").select("id, tool, tool_state, job_id").eq("id", taskId).maybeSingle();
  if (!task || task.tool !== "yellow") notFound();
  const { data: job } = await supabase.from("jobs").select("client_id").eq("id", task.job_id).single();
  const { data: client } = job
    ? await supabase.from("clients").select("name, business_name").eq("id", job.client_id).single()
    : { data: null };

  const ts = (task.tool_state ?? {}) as Record<string, string>;
  return (
    <YellowSheetForm
      taskId={taskId}
      firstName={client?.name?.split(" ")[0] ?? ""}
      initial={{ business_name: client?.business_name ?? "", ...ts }}
      submittedAt={ts.state === "submitted" ? ts.submitted_at ?? null : null}
    />
  );
}
