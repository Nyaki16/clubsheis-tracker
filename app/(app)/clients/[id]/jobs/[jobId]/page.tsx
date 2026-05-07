import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JobDetail from "./job-detail";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string; jobId: string }>;
}) {
  const { id, jobId } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (!job) notFound();

  const [clientRes, tasksRes, delsRes, profilesRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", job.client_id).single(),
    supabase.from("tasks").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
    supabase.from("deliverables").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("name"),
  ]);

  if (!clientRes.data) notFound();

  return (
    <div>
      <Link
        href={`/clients/${id}`}
        className="text-sm text-slate-500 hover:text-slate-900 mb-3 inline-block"
      >
        ← Back
      </Link>
      <JobDetail
        job={job}
        client={clientRes.data}
        tasks={tasksRes.data ?? []}
        deliverables={delsRes.data ?? []}
        profiles={profilesRes.data ?? []}
      />
    </div>
  );
}
