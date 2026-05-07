import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STAGES } from "@/lib/constants";
import type { Client, Job } from "@/lib/types";

export default async function PipelinePage() {
  const supabase = await createClient();
  const [jobsRes, clientsRes] = await Promise.all([
    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("*"),
  ]);

  const jobs: Job[] = jobsRes.data ?? [];
  const clients: Client[] = clientsRes.data ?? [];
  const getClient = (id: string) => clients.find((c) => c.id === id);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Pipeline</h2>
        <p className="text-slate-500 text-sm">All jobs across all clients, by stage.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {STAGES.map((stage) => {
          const stageJobs = jobs.filter((j) => j.stage === stage.id);
          return (
            <div key={stage.id} className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${stage.color}`}
                >
                  {stage.label}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {stageJobs.length}
                </span>
              </div>
              <div className="space-y-2">
                {stageJobs.map((job) => {
                  const client = getClient(job.client_id);
                  return (
                    <Link
                      key={job.id}
                      href={`/clients/${job.client_id}/jobs/${job.id}`}
                      className="block p-2 rounded border border-slate-200 hover:border-slate-400 bg-white"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: client?.color }}
                        />
                        <p className="text-xs text-slate-500 truncate">{client?.name}</p>
                      </div>
                      <p className="text-sm font-medium leading-tight">{job.name}</p>
                    </Link>
                  );
                })}
                {stageJobs.length === 0 && (
                  <p className="text-xs text-slate-400 italic px-1">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
