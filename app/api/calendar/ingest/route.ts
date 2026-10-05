import { createAdminClient } from "@/lib/supabase/admin";
import { bookingFrom, meetingKind, type Booking, type IncomingEvent } from "@/lib/calendar";
import { CLIENT_COLORS } from "@/lib/constants";
import { PHASES, type FlowTemplate } from "@/lib/flow";
import { normName, phoneKey } from "@/lib/duplicates";

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
  // Everyone already in the Tracker, kept in step as this batch changes things.
  const { data: allRows } = await sb.from("clients").select("*");
  const all = (allRows ?? []) as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  let colour = all.length;
  // Match on the calendar event, then email, then phone, then an exact name
  // (only when exactly one client has it, so namesakes aren't merged).
  const findExisting = (b: Booking) => {
    const byEvent = all.find((c) => c.call_event_id === b.eventId);
    if (byEvent) return byEvent;
    if (b.email) {
      const byEmail = all.find((c) => c.email && String(c.email).toLowerCase() === b.email);
      if (byEmail) return byEmail;
    }
    const pk = phoneKey(b.phone);
    if (pk) {
      const byPhone = all.find((c) => phoneKey(c.phone) === pk);
      if (byPhone) return byPhone;
    }
    const named = all.filter((c) => normName(c.name) === normName(b.name));
    return named.length === 1 ? named[0] : null;
  };
  const result = { leads: 0, past: 0, updated: 0, cancelled: 0, notes: 0, skipped: 0, meetings: 0, meeting_notes: 0 };

  // Discovery bookings create or update clients. Oldest first, so a person who
  // booked more than once ends up with their latest call.
  const bookings = events
    .filter((e) => /discovery/i.test(e.summary ?? ""))
    .map(bookingFrom)
    .filter((b): b is Booking => !!b && !!b.start)
    .sort((a, z) => a.start.localeCompare(z.start));

  for (const b of bookings) {
    if (b.email && ignore.has(b.email)) {
      result.skipped++;
      continue;
    }
    const existing = findExisting(b);

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
      if (Object.keys(patch).length) {
        await sb.from("clients").update(patch).eq("id", existing.id);
        Object.assign(existing, patch);
      }

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
      .select("*")
      .single();
    if (error) {
      result.skipped++;
      continue;
    }
    all.push(client);
    if (isLead) {
      await issueLeadTasks(sb, client.id, b, leadId);
      result.leads++;
    } else result.past++;
  }

  // Every meeting goes into Debbie's store, linked to the clients on its guest
  // list (meetings never create clients). Changed notes queue a refresh of
  // those clients' documents; new Team Scroll notes queue Debbie Recommends.
  const dirty = new Set<string>();
  for (const e of events) {
    if (!e.start) continue;
    const people = (e.attendees ?? []).filter((a) => a.email && !a.resource);
    const guests = people
      .map((a) => a.email.toLowerCase().trim())
      .filter((em) => !em.endsWith("@clubsheis.com") && !ignore.has(em));
    const matched = all.filter((c) => (c.email && guests.includes(String(c.email).toLowerCase())) || c.call_event_id === e.id);
    const { data: m } = await sb.from("meetings").select("id, notes").eq("event_id", e.id).maybeSingle();

    if (e.status === "cancelled") {
      if (m && !m.notes.trim()) await sb.from("meetings").delete().eq("id", m.id);
      continue;
    }
    const notes = (e.notesText ?? "").slice(0, 120000);
    const kind = meetingKind(e);
    const fields = {
      title: (e.summary ?? "").trim(),
      starts_at: e.start,
      ends_at: e.end || null,
      kind,
      attendees: people.map((a) => ({ email: a.email.toLowerCase(), name: a.displayName || undefined })),
      updated_at: new Date().toISOString(),
    };
    let meetingId = m?.id as string | undefined;
    const notesChanged = !!notes && notes !== (m?.notes ?? "");
    if (!m) {
      const { data: created } = await sb
        .from("meetings")
        .insert({ ...fields, event_id: e.id, notes, notes_url: e.notesUrl || null, source: "calendar" })
        .select("id")
        .single();
      meetingId = created?.id;
      result.meetings++;
    } else {
      await sb
        .from("meetings")
        .update(notesChanged ? { ...fields, notes, notes_url: e.notesUrl || null, debbie_processed_at: null } : fields)
        .eq("id", m.id);
    }
    if (!meetingId) continue;
    if (matched.length) {
      await sb.from("meeting_clients").upsert(
        matched.map((c) => ({ meeting_id: meetingId, client_id: c.id })),
        { onConflict: "meeting_id,client_id", ignoreDuplicates: true }
      );
      if (notesChanged) matched.forEach((c) => dirty.add(c.id));
    }
  }
  if (dirty.size) {
    await sb.from("clients").update({ docs_dirty_at: new Date().toISOString() }).in("id", [...dirty]);
    result.meeting_notes = dirty.size;
  }

  await sb
    .from("app_settings")
    .upsert({ key: "calendar_sync", value: { at: new Date().toISOString(), received: events.length, ...result }, updated_at: new Date().toISOString() });

  return Response.json({ ok: true, ...result });
}
