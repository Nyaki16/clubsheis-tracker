import { createAdminClient } from "@/lib/supabase/admin";
import { bookingFrom, type Booking, type IncomingEvent } from "@/lib/calendar";
import { CLIENT_COLORS } from "@/lib/constants";
import { PHASES, type FlowTemplate } from "@/lib/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Bookings from this date become active leads; older unmatched ones are
// archived as past leads.
const LEADS_FROM = new Date(process.env.CALENDAR_LEADS_FROM || "2026-09-01T00:00:00+02:00");

type Admin = ReturnType<typeof createAdminClient>;
const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);

async function defaultLeadId(sb: Admin) {
  const { data } = await sb.from("profiles").select("id, email, name");
  const g = (data ?? []).find((p) => /^gizelle@/i.test(p.email) || /^gizelle/i.test(p.name));
  return g?.id ?? null;
}

// Issue the "Package not chosen" tasks, with the booking in the Discovery task.
async function issueLeadTasks(sb: Admin, clientId: string, b: Booking, leadId: string | null) {
  const { data: job, error } = await sb
    .from("jobs")
    .insert({ client_id: clientId, name: "Client flow", kind: "flow", stage: "briefing" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: tpl } = await sb.from("flow_templates").select("*").eq("package", "lead").order("position");
  const rows = ((tpl ?? []) as FlowTemplate[]).sort(
    (a, z) => PHASES.findIndex((p) => p.id === a.phase) - PHASES.findIndex((p) => p.id === z.phase) || a.position - z.position
  );
  const call = new Date(b.start);
  const past = call < new Date();
  const discoveryDue = addDays(past ? new Date() : call, past ? 2 : 0);
  await sb.from("tasks").insert(
    rows.map((t, i) => ({
      job_id: job.id,
      title: t.title,
      phase: t.phase,
      position: t.position,
      tool: t.tool,
      assignee_id: t.default_assignee_id ?? leadId,
      status: t.tool === "discovery" && past ? "in_progress" : "planning",
      due_date: day(i === 0 ? discoveryDue : addDays(discoveryDue, 2 + i)),
      notes: "",
      tool_state:
        t.tool === "discovery"
          ? { need: b.message ?? "", transcript: b.notesText ?? "", link: b.notesUrl ?? "", lead: "", from_calendar: true }
          : {},
    }))
  );
}

export async function POST(req: Request) {
  const secret = process.env.CALENDAR_SYNC_SECRET;
  if (!secret) return Response.json({ error: "CALENDAR_SYNC_SECRET isn't set on the Tracker." }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const { events } = (await req.json()) as { events: IncomingEvent[] };
  if (!Array.isArray(events)) return Response.json({ error: "Expected { events: [...] }" }, { status: 400 });

  const sb = createAdminClient();
  const ignore = new Set((process.env.CALENDAR_IGNORE_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
  const leadId = await defaultLeadId(sb);
  const { count } = await sb.from("clients").select("*", { count: "exact", head: true });
  let colour = count ?? 0;
  const result = { leads: 0, past: 0, updated: 0, cancelled: 0, notes: 0, skipped: 0 };

  // Oldest first, so a person who booked more than once ends up with their latest call.
  const bookings = events
    .map(bookingFrom)
    .filter((b): b is Booking => !!b && !!b.start)
    .sort((a, z) => a.start.localeCompare(z.start));

  for (const b of bookings) {
    if (b.email && ignore.has(b.email)) {
      result.skipped++;
      continue;
    }
    const { data: byEvent } = await sb.from("clients").select("*").eq("call_event_id", b.eventId).maybeSingle();
    const existing =
      byEvent ??
      (b.email ? (await sb.from("clients").select("*").ilike("email", b.email).limit(1).maybeSingle()).data : null);

    if (b.cancelled) {
      if (existing && existing.call_event_id === b.eventId && !existing.call_cancelled) {
        await sb.from("clients").update({ call_cancelled: true }).eq("id", existing.id);
        result.cancelled++;
      }
      continue;
    }

    if (existing) {
      const isNewerCall = !existing.call_at || new Date(b.start) >= new Date(existing.call_at) || existing.call_event_id === b.eventId;
      const patch: Record<string, unknown> = {};
      if (!existing.email && b.email) patch.email = b.email;
      if (!existing.phone && b.phone) patch.phone = b.phone;
      if (isNewerCall) {
        Object.assign(patch, {
          call_event_id: b.eventId,
          call_at: b.start,
          call_title: b.title,
          call_cancelled: false,
          call_message: b.message ?? existing.call_message,
          call_notes_url: b.notesUrl ?? (existing.call_event_id === b.eventId ? existing.call_notes_url : null),
          call_notes: b.notesText ?? (existing.call_event_id === b.eventId ? existing.call_notes : null),
        });
      }
      // A past lead who books again comes back into Sales.
      const revive = existing.is_past_lead && new Date(b.start) >= LEADS_FROM;
      if (revive) patch.is_past_lead = false;
      if (Object.keys(patch).length) await sb.from("clients").update(patch).eq("id", existing.id);

      if (revive) {
        const { data: job } = await sb.from("jobs").select("id").eq("client_id", existing.id).eq("kind", "flow").maybeSingle();
        if (!job) {
          await sb.from("clients").update({ package: "lead", lead_id: existing.lead_id ?? leadId }).eq("id", existing.id);
          await issueLeadTasks(sb, existing.id, b, existing.lead_id ?? leadId);
        }
      }

      // Gemini notes arrive after the call: drop them into an empty Discovery task.
      if (b.notesText && isNewerCall) {
        const { data: job } = await sb.from("jobs").select("id").eq("client_id", existing.id).eq("kind", "flow").maybeSingle();
        if (job) {
          const { data: disc } = await sb.from("tasks").select("id, tool_state").eq("job_id", job.id).eq("tool", "discovery").maybeSingle();
          const ts = (disc?.tool_state ?? {}) as Record<string, unknown>;
          if (disc && !String(ts.transcript ?? "").trim()) {
            await sb
              .from("tasks")
              .update({ tool_state: { ...ts, transcript: b.notesText, link: ts.link || b.notesUrl || "" } })
              .eq("id", disc.id);
            result.notes++;
          }
        }
      }
      result.updated++;
      continue;
    }

    const isLead = new Date(b.start) >= LEADS_FROM;
    const { data: client, error } = await sb
      .from("clients")
      .insert({
        name: b.name,
        color: CLIENT_COLORS[colour++ % CLIENT_COLORS.length],
        email: b.email,
        phone: b.phone,
        package: isLead ? "lead" : null,
        lead_id: leadId,
        is_past_lead: !isLead,
        source: "calendar",
        call_event_id: b.eventId,
        call_at: b.start,
        call_title: b.title,
        call_message: b.message,
        call_notes_url: b.notesUrl,
        call_notes: b.notesText,
      })
      .select("id")
      .single();
    if (error) {
      result.skipped++;
      continue;
    }
    if (isLead) {
      await issueLeadTasks(sb, client.id, b, leadId);
      result.leads++;
    } else result.past++;
  }

  await sb
    .from("app_settings")
    .upsert({ key: "calendar_sync", value: { at: new Date().toISOString(), received: events.length, ...result }, updated_at: new Date().toISOString() });

  return Response.json({ ok: true, ...result });
}
