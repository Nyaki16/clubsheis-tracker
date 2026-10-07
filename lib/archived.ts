// Past leads are archived: their tasks stay on their page (and come back if
// they're moved to Sales again) but drop out of every team-wide task list.
type HasJob = { job_id: string };

export function withoutArchived<T extends HasJob>(
  tasks: T[],
  jobs: { id: string; client_id: string }[],
  clients: { id: string; is_past_lead?: boolean | null }[]
): T[] {
  const archived = new Set(clients.filter((c) => c.is_past_lead).map((c) => c.id));
  if (!archived.size) return tasks;
  const archivedJobs = new Set(jobs.filter((j) => archived.has(j.client_id)).map((j) => j.id));
  return tasks.filter((t) => !archivedJobs.has(t.job_id));
}
