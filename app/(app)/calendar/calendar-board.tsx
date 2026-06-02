"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import type { Client, ClientDate } from "@/lib/types";
import { expandDates } from "@/lib/recurrence";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalendarBoard({
  dates,
  clients,
}: {
  dates: ClientDate[];
  clients: Client[];
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  // Selected client IDs; empty Set means "show all".
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem("calendar.pickedClients");
      if (raw) setPicked(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "calendar.pickedClients",
        JSON.stringify(Array.from(picked))
      );
    } catch {}
  }, [picked]);

  const clientById = useMemo(() => {
    const m = new Map<string, Client>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const visibleDates = useMemo(() => {
    if (picked.size === 0) return dates;
    return dates.filter((d) => picked.has(d.client_id));
  }, [dates, picked]);

  // Build a 6-week grid covering the visible month.
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // Sunday before/on the 1st
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  // Expand recurring rows into concrete instances within the visible grid.
  const datesByDay = useMemo(() => {
    if (grid.length === 0) return new Map<string, ClientDate[]>();
    const start = grid[0];
    const end = grid[grid.length - 1];
    const instances = expandDates(visibleDates, start, end);
    const map = new Map<string, ClientDate[]>();
    instances.forEach((i) => {
      if (!map.has(i.date)) map.set(i.date, []);
      map.get(i.date)!.push(i.source);
    });
    return map;
  }, [visibleDates, grid]);

  function togglePicked(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const todayYmd = ymd(today);

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold mb-1">Calendar</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Every client&apos;s key dates, in one view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="text-xs px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
          >
            Today
          </button>
          <button
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="text-lg font-semibold ml-3">
            {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
        </div>
      </div>

      {/* Client filter chips */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">
            Clients
          </span>
          {picked.size > 0 && (
            <button
              onClick={() => setPicked(new Set())}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Show all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {clients.map((c) => {
            const active = picked.size === 0 || picked.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => togglePicked(c.id)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition ${
                  active
                    ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Month grid */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
          {DAY_NAMES.map((n) => (
            <div
              key={n}
              className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium px-2 py-1.5 text-center"
            >
              {n}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 grid-rows-6">
          {grid.map((d, i) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const key = ymd(d);
            const isToday = key === todayYmd;
            const dayDates = datesByDay.get(key) ?? [];
            return (
              <div
                key={i}
                className={`relative min-h-24 border-r border-b border-slate-100 dark:border-slate-800 p-1.5 ${
                  inMonth
                    ? "bg-white dark:bg-slate-900"
                    : "bg-slate-50/60 dark:bg-slate-800/30"
                } ${(i + 1) % 7 === 0 ? "border-r-0" : ""} ${
                  i >= 35 ? "border-b-0" : ""
                }`}
              >
                <div
                  className={`text-xs font-medium mb-1 ${
                    isToday
                      ? "inline-flex w-5 h-5 items-center justify-center bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-full"
                      : inMonth
                      ? "text-slate-700 dark:text-slate-300"
                      : "text-slate-400 dark:text-slate-600"
                  }`}
                >
                  {d.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayDates.slice(0, 4).map((evt) => {
                    const client = clientById.get(evt.client_id);
                    return (
                      <Link
                        key={`${evt.id}-${key}`}
                        href={`/clients/${evt.client_id}`}
                        className="flex items-center text-[10px] px-1.5 py-0.5 rounded truncate border gap-1"
                        style={{
                          backgroundColor: (client?.color ?? "#64748b") + "22",
                          borderColor: (client?.color ?? "#64748b") + "55",
                          color: "var(--page-text)",
                        }}
                        title={`${evt.title}${client ? ` — ${client.name}` : ""}${
                          evt.recurrence !== "none" ? ` (${evt.recurrence})` : ""
                        }${evt.notes ? `\n${evt.notes}` : ""}`}
                      >
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: client?.color ?? "#64748b" }}
                        />
                        <span className="truncate flex-1 min-w-0">{evt.title}</span>
                        {evt.recurrence !== "none" && (
                          <Repeat className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
                        )}
                      </Link>
                    );
                  })}
                  {dayDates.length > 4 && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 px-1.5">
                      +{dayDates.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {visibleDates.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 text-center">
          {dates.length === 0
            ? "No client dates yet. Add some from any client profile."
            : "No dates match the current client filter."}
        </p>
      )}
    </div>
  );
}
