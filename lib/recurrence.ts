import type { ClientDate, Recurrence } from "./types";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function step(d: Date, rule: Recurrence) {
  switch (rule) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
}

export type DateInstance = {
  date: string; // YYYY-MM-DD
  source: ClientDate;
  isFirst: boolean;
};

// Expand every recurring ClientDate into the concrete instances falling in
// [windowStart, windowEnd] (inclusive). Non-recurring rows produce a single
// instance if their date sits in the window.
//
// Safety: caps at MAX_INSTANCES per series so a runaway rule can't blow up
// the page.
const MAX_INSTANCES = 500;

export function expandDates(
  dates: ClientDate[],
  windowStart: Date,
  windowEnd: Date
): DateInstance[] {
  const startKey = ymd(windowStart);
  const endKey = ymd(windowEnd);
  const out: DateInstance[] = [];

  for (const d of dates) {
    if (d.recurrence === "none") {
      if (d.date >= startKey && d.date <= endKey) {
        out.push({ date: d.date, source: d, isFirst: true });
      }
      continue;
    }

    const seriesEnd =
      d.recurrence_until && d.recurrence_until < endKey
        ? d.recurrence_until
        : endKey;

    const cursor = new Date(d.date + "T00:00:00");
    let isFirst = true;
    let count = 0;
    while (count < MAX_INSTANCES) {
      const key = ymd(cursor);
      if (key > seriesEnd) break;
      if (key >= startKey) {
        out.push({ date: key, source: d, isFirst });
      }
      step(cursor, d.recurrence);
      isFirst = false;
      count++;
    }
  }

  return out;
}

export function recurrenceLabel(r: Recurrence): string {
  switch (r) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    default:
      return "";
  }
}

// "14:30:00" or "14:30" → "2:30 PM". Empty/null → "".
export function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = Number(mStr ?? "0");
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${h12} ${ampm}`
    : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
