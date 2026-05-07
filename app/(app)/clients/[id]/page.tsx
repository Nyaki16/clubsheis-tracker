import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { STAGES } from "@/lib/constants";
import NewJobButton from "./new-job-button";
import { formatDate } from "@/lib/utils";
import type { Job, Task } from "@/lib/types";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const [jobsRes, tasksRes] = await Promise.all([
    supabase.from("jobs").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("tasks").select("*"),
  ]);

  const jobs: Job[] = jobsRes.data ?? [];
  const tasks: Task[] = tasksRes.data ?? [];

  return (
    <div>
      <Link href="/clients" className="text-sm text-slate-500 hover:text-slate-900 mb-3 inline-block">
        ← All clients
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: client.color }}
          >
            {client.name[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{client.name}</h2>
            <p className="text-slate-500 text-sm">{jobs.length} total jobs</p>
          </div>
        </div>
        <NewJobButton clientId={client.id} />
      </div>

      <div className="space-y-3">
        {jobs.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="text-slate-500 text-sm">No jobs yet. Click &quot;New job&quot; to start.</p>
          </div>
        )}
        {jobs.map((job) => {
          const stage = STAGES.find((s) => s.id === job.stage);
          const jobTasks = tasks.filter((t) => t.job_id === job.id);
          const doneTasks = jobTasks.filter(
            (t) => t.status === "closed_out" || t.status === "published"
          ).length;
          return (
            <Link
              key={job.id}
              href={`/clients/${client.id}/jobs/${job.id}`}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-400 transition flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h3 className="font-semibold">{job.name}</h3>
                  {stage && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${stage.color}`}>
                      {stage.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span>
                    {doneTasks}/{jobTasks.length} tasks done
                  </span>
                  {job.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatDate(job.due_date)}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
