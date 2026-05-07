import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isToday(d: string | null | undefined) {
  if (!d) return false;
  return new Date(d).toDateString() === new Date().toDateString();
}

export function isOverdue(d: string | null | undefined) {
  if (!d) return false;
  return new Date(d) < new Date(new Date().toDateString());
}

export function isThisWeek(d: string | null | undefined) {
  if (!d) return false;
  const date = new Date(d);
  const today = new Date();
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  return date >= today && date <= weekFromNow;
}

export function formatDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
