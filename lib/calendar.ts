// Turning a booked discovery call (a Google Calendar event sent by the
// ClubSheIs Apps Script) into client details.

export type IncomingEvent = {
  id: string;
  status?: string; // "confirmed" | "tentative" | "cancelled"
  summary?: string;
  start?: string; // ISO date-time
  description?: string;
  attendees?: { email: string; displayName?: string; organizer?: boolean; self?: boolean }[];
  notesUrl?: string; // "Notes by Gemini" doc attached to the event
  notesText?: string;
};

export type Booking = {
  eventId: string;
  cancelled: boolean;
  title: string;
  start: string;
  email: string | null;
  name: string;
  phone: string | null;
  message: string | null;
  notesUrl: string | null;
  notesText: string | null;
};

const TEAM_DOMAIN = "@clubsheis.com";

// Strip the booking-page wording from a title to leave the person's name, e.g.
// "Ghutte Discovery Call - Jerrod G", "Discovery Call/ System sessions  Tumi Deane",
// "Kabelo X CSI Discovery", "Discovery Call x ClubSheIs x Dr Letsoalo".
export function nameFromTitle(title: string) {
  const cleaned = title
    .replace(/\b(ghutte|agency)\b/gi, " ")
    .replace(/\bdiscovery(\s*\/\s*strategy)?\s*calls?\b/gi, " ")
    .replace(/\bsystem\s+sessions?\b/gi, " ")
    .replace(/\bdiscovery\s+with\b/gi, " ")
    .replace(/\bdiscovery\b/gi, " ")
    .replace(/\b(csi|clubsheis|club she is)\b/gi, " ")
    .replace(/(^|\s)x(\s|$)/gi, " ")
    .replace(/[-—–:/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return tidyName(cleaned);
}

export function tidyName(name: string) {
  const n = name.replace(/\s+/g, " ").trim();
  // Booking forms sometimes arrive in capitals or repeat a surname.
  const fixed = n === n.toUpperCase() ? n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : n;
  return fixed.replace(/\b(\w+) \1\b/gi, "$1");
}

export function bookingFrom(e: IncomingEvent): Booking | null {
  const guests = (e.attendees ?? []).filter(
    (a) => a.email && !a.email.toLowerCase().endsWith(TEAM_DOMAIN) && !a.organizer && !a.self
  );
  const desc = e.description ?? "";
  const descEmail = desc.match(/Email:-\s*([^\s<]+@[^\s<]+)/i)?.[1] ?? desc.match(/Client Email:\s*([^\s<]+@[^\s<]+)/i)?.[1] ?? null;
  const email = (guests[0]?.email ?? descEmail)?.toLowerCase().trim() ?? null;
  if (!email && !guests.length) return null; // internal meeting

  const phone =
    desc.match(/Phone:-\s*(\+?\d[\d\s]{6,})/i)?.[1]?.trim() ?? desc.match(/Client Phone:\s*(\+?\d[\d\s]{6,})/i)?.[1]?.trim() ?? null;
  let message = desc.split("==========")[0].replace(/\s+/g, " ").trim();
  if (/^client name:/i.test(message) || /^(no|none|not really|n\/a)\.?$/i.test(message)) message = "";

  const title = (e.summary ?? "").trim();
  const name = tidyName(guests[0]?.displayName?.trim() || "") || nameFromTitle(title) || email || "New lead";

  return {
    eventId: e.id,
    cancelled: e.status === "cancelled",
    title,
    start: e.start ?? "",
    email,
    name,
    phone,
    message: message || null,
    notesUrl: e.notesUrl || null,
    notesText: e.notesText?.slice(0, 60000) || null,
  };
}
