export type Profile = {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  avatar_url: string | null;
  created_at: string;
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
    | "awaiting_client"
    | "published"
    | "closed_out";
  priority_rank: 1 | 2 | 3 | null;
  url: string | null;
  sent_for_approval: boolean;
  approver_id: string | null;
  approved: boolean;
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
