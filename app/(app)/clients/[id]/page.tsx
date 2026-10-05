import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchClientFlowDocs } from "@/lib/client-flow";
import type { Client, ClientDate, ClientDocument, Job, Meeting, Profile, ProjectBrief, Task } from "@/lib/types";
import ClientIntel from "@/components/flow/client-intel";
import type { FlowTemplate, PricingTier } from "@/lib/flow";
import ClientDetail from "./client-detail";
import FlowClientView from "./flow-client-view";

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

  const [jobsRes, profilesRes, datesRes, templatesRes, tiersRes, clientFlowDocs, meetingsRes, docsRes, briefsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("name"),
    supabase
      .from("client_dates")
      .select("*")
      .eq("client_id", id)
      .order("date", { ascending: true }),
    supabase.from("flow_templates").select("*").order("position"),
    supabase.from("pricing_tiers").select("*").order("position"),
    fetchClientFlowDocs(client.name),
    supabase.from("meeting_clients").select("meetings(*)").eq("client_id", id),
    supabase.from("client_documents").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(30),
    supabase.from("project_briefs").select("*").eq("client_id", id).order("created_at", { ascending: false }),
  ]);
  const meetings = ((meetingsRes.data ?? []) as unknown as { meetings: Meeting | null }[])
    .map((r) => r.meetings)
    .filter((m): m is Meeting => !!m && !!m.notes.trim());

  const allJobs: Job[] = jobsRes.data ?? [];
  const jobIds = allJobs.map((j) => j.id);
  const { data: taskRows } = jobIds.length
    ? await supabase.from("tasks").select("*").in("job_id", jobIds).order("created_at", { ascending: false })
    : { data: [] as Task[] };
  const tasks: Task[] = taskRows ?? [];

  const flowJob = allJobs.find((j) => j.kind === "flow");
  const otherJobs = allJobs.filter((j) => j.kind !== "flow");
  const flowTasks = flowJob ? tasks.filter((t) => t.job_id === flowJob.id) : [];
  const otherTasks = tasks.filter((t) => t.job_id !== flowJob?.id);
  const profiles: Profile[] = profilesRes.data ?? [];
  const dates: ClientDate[] = datesRes.data ?? [];
  const briefs = (briefsRes.data ?? []) as ProjectBrief[];
  const discovery = flowTasks.find((t) => t.tool === "discovery")?.tool_state as Record<string, string> | undefined;
  const words = (t: unknown) => String(t ?? "").split(/\s+/).filter(Boolean).length;
  const discoveryWords = words(discovery?.need) + words(discovery?.transcript || client.call_notes) + words(client.call_message);

  return (
    <div className="flex flex-col gap-8">
      <FlowClientView
        client={client as Client}
        tasks={flowTasks}
        profiles={profiles}
        templates={(templatesRes.data ?? []) as FlowTemplate[]}
        tiers={(tiersRes.data ?? []) as PricingTier[]}
        migrated={!templatesRes.error}
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Profile, meetings &amp; other jobs</h2>
        <ClientIntel
          client={client as Client}
          meetings={meetings}
          docs={(docsRes.data ?? []) as ClientDocument[]}
          profiles={profiles}
          briefs={briefs}
          briefTasks={tasks.filter((t) => t.brief_id)}
          discoveryWords={discoveryWords}
          hasFlow={!!flowJob}
        />
        <ClientDetail
          client={client as Client}
          jobs={otherJobs}
          tasks={otherTasks}
          profiles={profiles}
          dates={dates}
          clientFlowDocs={clientFlowDocs}
          embedded
        />
      </section>
    </div>
  );
}
