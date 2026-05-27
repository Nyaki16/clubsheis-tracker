import { AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TASK_STATUSES } from "@/lib/constants";
import type { Client, Deliverable, Job, Profile, Task } from "@/lib/types";
import Avatar from "@/components/avatar";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [tasksRes, clientsRes, jobsRes, delsRes, profilesRes] = await Promise.all([
    supabase.from("tasks").select("*"),
    supabase.from("clients").select("*"),
    supabase.from("jobs").select("*"),
    supabase.from("deliverables").select("*"),
    supabase.from("profiles").select("*"),
  ]);

  const tasks: Task[] = tasksRes.data ?? [];
  const clients: Client[] = clientsRes.data ?? [];
  const jobs: Job[] = jobsRes.data ?? [];
  const deliverables: Deliverable[] = delsRes.data ?? [];
  const profiles: Profile[] = profilesRes.data ?? [];

  const openTasks = tasks.filter((t) => t.status !== "closed_out" && t.status !== "published");
  const overdueCount = openTasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date()
  ).length;

  const stuckReviews = deliverables.filter((d) => {
    if (d.status !== "client_reviewing") return false;
    const updated = new Date(d.updated_at ?? d.created_at);
    const hours = (Date.now() - updated.getTime()) / (1000 * 60 * 60);
    return hours > 24;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Overview</h2>
        <p className="text-slate-500 text-sm">What&apos;s moving, what&apos;s stuck, what needs you.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Active clients" value={clients.length} />
        <Stat label="Jobs in flight" value={jobs.filter((j) => j.stage !== "delivered").length} />
        <Stat label="Open tasks" value={openTasks.length} valueClass="text-amber-600" />
        <Stat label="Overdue" value={overdueCount} valueClass="text-rose-600" />
      </div>

      {stuckReviews.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">
                {stuckReviews.length}{" "}
                {stuckReviews.length === 1 ? "deliverable" : "deliverables"} stuck in client review
              </h3>
              <p className="text-sm text-amber-800 mt-1">Sitting longer than 24 hours. Time to chase.</p>
              <ul className="mt-2 space-y-1">
                {stuckReviews.map((d) => {
                  const job = jobs.find((j) => j.id === d.job_id);
                  const client = job ? clients.find((c) => c.id === job.client_id) : null;
                  return (
                    <li key={d.id} className="text-sm text-amber-900">
                      • <strong>{client?.name ?? "—"}</strong> — {d.name}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold mb-4">Tasks by status</h3>
          <div className="space-y-2">
            {TASK_STATUSES.map((s) => {
              const count = tasks.filter((t) => t.status === s.id).length;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                    <span className="text-sm">{s.label}</span>
                  </div>
                  <span className="font-semibold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold mb-4">Team workload</h3>
          <div className="space-y-2">
            {profiles.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No team members yet.</p>
            ) : (
              profiles.map((p) => {
                const count = tasks.filter(
                  (t) =>
                    t.assignee_id === p.id &&
                    t.status !== "closed_out" &&
                    t.status !== "published"
                ).length;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} url={p.avatar_url} size="md" />
                      <span className="text-sm">{p.name}</span>
                    </div>
                    <span className="font-semibold">{count}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className={`text-3xl font-bold ${valueClass ?? ""}`}>{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}
