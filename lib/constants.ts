export const STAGES = [
  { id: "briefing", label: "Briefing", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { id: "planning", label: "Planning", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "scripts", label: "Scripts", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { id: "shoot", label: "Shoot", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "edit", label: "Edit", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { id: "qa", label: "QA", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { id: "delivered", label: "Delivered", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export const TASK_STATUSES = [
  { id: "planning", label: "Planning", color: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  { id: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  { id: "in_review", label: "In Review", color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  { id: "internally_reviewed", label: "Internally Reviewed", color: "bg-teal-100 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  { id: "awaiting_client", label: "Awaiting Client Approval", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  { id: "published", label: "Published", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  { id: "closed_out", label: "Closed Out", color: "bg-slate-200 text-slate-500 border-slate-300", dot: "bg-slate-400" },
] as const;

export type TaskStatusId = (typeof TASK_STATUSES)[number]["id"];

export const DELIVERABLE_STATUSES = [
  { id: "in_progress", label: "In Progress", color: "bg-slate-100 text-slate-700" },
  { id: "delivered", label: "Delivered", color: "bg-blue-100 text-blue-700" },
  { id: "client_reviewing", label: "Client Reviewing", color: "bg-amber-100 text-amber-700" },
  { id: "revision_requested", label: "Revision Requested", color: "bg-rose-100 text-rose-700" },
  { id: "revised", label: "Revised", color: "bg-violet-100 text-violet-700" },
  { id: "approved", label: "Approved", color: "bg-emerald-100 text-emerald-700" },
] as const;

export type DeliverableStatusId = (typeof DELIVERABLE_STATUSES)[number]["id"];

export const CLIENT_COLORS = [
  "#8B5CF6", "#EC4899", "#F59E0B", "#10B981",
  "#3B82F6", "#EF4444", "#14B8A6", "#F97316",
];
