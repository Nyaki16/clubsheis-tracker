export type Profile = {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export type Job = {
  id: string;
  client_id: string;
  name: string;
  stage: "briefing" | "planning" | "scripts" | "shoot" | "edit" | "qa" | "delivered";
  due_date: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  job_id: string;
  title: string;
  assignee_id: string | null;
  due_date: string | null;
  notes: string;
  status:
    | "planning"
    | "in_progress"
    | "in_review"
    | "awaiting_client"
    | "published"
    | "closed_out";
  priority_rank: 1 | 2 | 3 | null;
  created_at: string;
  updated_at: string;
};

export type Deliverable = {
  id: string;
  job_id: string;
  name: string;
  status:
    | "in_progress"
    | "delivered"
    | "client_reviewing"
    | "revision_requested"
    | "revised"
    | "approved";
  created_at: string;
  updated_at: string;
};
