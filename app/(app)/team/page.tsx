import { createClient } from "@/lib/supabase/server";
import { TASK_STATUSES } from "@/lib/constants";
import type { Client, Job, Profile, Task } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import InviteButton from "./invite-button";
import MemberActions from "./member-actions";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [profilesRes, tasksRes, jobsRes, clientsRes] = await Promise.all([
    supabase.from("profiles").select("*").order("name"),
    supabase.from("tasks").select("*"),
    supabase.from("jobs").select("*"),
    supabase.from("clients").select("*"),
  ]);

  const profiles: Profile[] = profilesRes.data ?? [];
  const tasks: Task[] = tasksRes.data ?? [];
  const jobs: Job[] = jobsRes.data ?? [];
  const clients: Client[] = clientsRes.data ?? [];
  const me = profiles.find((p) => p.id === user?.id);
  const isAdmin = !!me?.is_admin;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold mb-1">Team</h2>
          <p className="text-slate-500 text-sm">Who&apos;s working on what.</p>
        </div>
        {isAdmin && <InviteButton />}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.length === 0 && (
          <div className="md:col-span-2 bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <p className="text-slate-500 text-sm">
              No team members yet.{" "}
              {isAdmin
                ? "Click \"Add user\" to invite someone."
                : "Ask an admin to invite people."}
            </p>
          </div>
        )}
        {profiles.map((p) => {
          const memberTasks = tasks.filter((t) => t.assignee_id === p.id);
          const open = memberTasks.filter(
            (t) => t.status !== "closed_out" && t.status !== "published"
          );
          const overdue = open.filter(
            (t) => t.due_date && new Date(t.due_date) < new Date()
          );
          return (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                  {p.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.is_admin && (
                      <span className="text-[10px] uppercase tracking-wide bg-slate-900 text-white px-1.5 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {open.length} open · {overdue.length} overdue
                  </p>
                </div>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {open.length === 0 && (
                  <p className="text-sm text-slate-400 italic">All clear.</p>
                )}
                {open.map((task) => {
                  const job = jobs.find((j) => j.id === task.job_id);
                  const client = job ? clients.find((c) => c.id === job.client_id) : null;
                  const status =
                    TASK_STATUSES.find((s) => s.id === task.status) ?? TASK_STATUSES[0];
                  const taskOverdue =
                    task.due_date && new Date(task.due_date) < new Date();
                  return (
                    <div key={task.id} className="text-sm p-2 rounded bg-slate-50">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium leading-tight">{task.title}</p>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded border ${status.color} flex-shrink-0`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {client && <span>{client.name}</span>}
                        {task.due_date && (
                          <span className={taskOverdue ? "text-rose-600 font-medium" : ""}>
                            {formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {isAdmin && (
                <MemberActions
                  profileId={p.id}
                  isAdminUser={p.is_admin}
                  isSelf={p.id === user?.id}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
