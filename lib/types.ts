export type Profile = {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  avatar_url: string | null;
  surname: string | null;
  cellphone: string | null;
  home_address: string | null;
  next_of_kin: string | null;
  next_of_kin_phone: string | null;
  id_document_url: string | null;
  job_title: string | null;
  start_date: string | null;
  annual_leave_allowance: number;
  created_at: string;
};

export type ProfileFields = {
  name?: string;
  surname?: string | null;
  cellphone?: string | null;
  home_address?: string | null;
  next_of_kin?: string | null;
  next_of_kin_phone?: string | null;
  id_document_url?: string | null;
  job_title?: string | null;
  start_date?: string | null;
  annual_leave_allowance?: number;
};

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveRequest = {
  id: string;
  requester_id: string;
  approver_id: string | null;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  decided_at: string | null;
  decided_notes: string;
  created_at: string;
};

export type LeaveRequestInput = {
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
};

export type Client = {
  id: string;
  name: string;
  color: string;
  business_name: string | null;
  about: string | null;
  profile_pic_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  google_drive_url: string | null;
  canva_brand_url: string | null;
  client_profile_doc_url: string | null;
  research_bible_doc_url: string | null;
  brand_voice_doc_url: string | null;
  strategy_brief_doc_url: string | null;
  created_at: string;
};

export type ClientProfileInput = {
  name: string;
  business_name: string | null;
  about: string | null;
  profile_pic_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  google_drive_url: string | null;
  canva_brand_url: string | null;
  client_profile_doc_url: string | null;
  research_bible_doc_url: string | null;
  brand_voice_doc_url: string | null;
  strategy_brief_doc_url: string | null;
};

export type ClientFlowDocs = {
  client_profile_doc_url: string | null;
  research_bible_doc_url: string | null;
  brand_voice_doc_url: string | null;
  strategy_brief_doc_url: string | null;
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
    | "internally_reviewed"
    | "awaiting_client"
    | "published"
    | "closed_out";
  priority_rank: 1 | 2 | 3 | null;
  url: string | null;
  sent_for_approval: boolean;
  approver_id: string | null;
  approved: boolean;
  originator_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type ClientDate = {
  id: string;
  client_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM (24h) or null for all-day
  notes: string;
  recurrence: Recurrence;
  recurrence_until: string | null; // YYYY-MM-DD
  created_at: string;
};

export type ClientDateInput = {
  title: string;
  date: string;
  time?: string | null;
  notes?: string;
  recurrence?: Recurrence;
  recurrence_until?: string | null;
};

export type Asset = {
  id: string;
  name: string;
  category: string;
  serial: string;
  assigned_to: string | null;
  purchased_on: string | null;
  notes: string;
  model: string | null;
  processor: string | null;
  memory: string | null;
  os: string | null;
  graphics: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetInput = {
  name: string;
  category: string;
  serial?: string;
  assigned_to?: string | null;
  purchased_on?: string | null;
  notes?: string;
  model?: string | null;
  processor?: string | null;
  memory?: string | null;
  os?: string | null;
  graphics?: string | null;
};

export type Sop = {
  id: string;
  title: string;
  category: string;
  body: string;
  url: string | null;
  created_at: string;
  updated_at: string;
};

export type SopInput = {
  title: string;
  category: string;
  body: string;
  url?: string | null;
};

export type VaultLink = {
  id: string;
  label: string;
  url: string;
  notes: string;
  created_at: string;
};

export type VaultLinkInput = {
  label: string;
  url: string;
  notes?: string;
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
