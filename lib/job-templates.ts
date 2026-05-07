// Job templates — each one corresponds to a ClubSheIs package on
// https://www.clubsheis.com/products. Selecting a template at job creation
// time auto-creates the listed tasks (assignee/due/notes blank, status=planning).
//
// Edit task lists here as the workflow evolves; changes ship on next deploy.

export type JobTemplate = {
  id: string;
  label: string;
  defaultJobName: string;
  description: string;
  tasks: string[];
};

export const JOB_TEMPLATES: JobTemplate[] = [
  {
    id: "bronze",
    label: "Small Business — Bronze",
    defaultJobName: "Bronze — Monthly cycle",
    description: "R3,800/mo · Ghutte access + tutorials + monthly strategy session",
    tasks: [
      "Send Ghutte platform login & onboarding email",
      "Confirm video tutorial library access",
      "Schedule monthly 1-hour strategy session",
      "Run strategy session",
      "Send recap & action items",
    ],
  },
  {
    id: "silver",
    label: "Small Business — Silver",
    defaultJobName: "Silver — Monthly cycle",
    description: "R5,500/mo · Strategy + 12 posts/mo (4 reels, 8 static)",
    tasks: [
      "Schedule 30-min monthly strategy call",
      "Run strategy call & confirm content direction",
      "Confirm Ghutte platform access",
      "Ideate 4 Reel concepts",
      "Script 4 Reels",
      "Shoot/source footage for 4 Reels",
      "Edit 4 Reels",
      "Design 8 static feed posts",
      "Write captions for all 12 posts",
      "Client approval round",
      "Schedule 12 posts to platforms",
      "Send monthly recap",
    ],
  },
  {
    id: "gold_obm",
    label: "Small Business — Gold / OBM",
    defaultJobName: "Gold / OBM — Onboarding & system build",
    description: "R7,500/mo (3-mo min) · Workflow + system + Ghutte migration",
    tasks: [
      "Map current sales workflow",
      "Design optimised workflow",
      "Migrate client to Ghutte platform",
      "Set up sales workflow inside Ghutte",
      "Configure email templates",
      "Configure ads (basic setup)",
      "Run personal training session",
      "Hand over onboarding documentation",
      "Monthly check-in",
    ],
  },
  {
    id: "ads_only",
    label: "OBM Growth — Ads Only",
    defaultJobName: "Ads Only — Monthly cycle",
    description: "R12,500/mo · Meta ads + website audit + automation (no newsletters)",
    tasks: [
      "Audit website",
      "Apply website updates",
      "Optimise social media profiles",
      "Set up Meta ads campaigns (per product category)",
      "Set up email automation flows",
      "Monitor & optimise ads weekly",
      "Run 1-hour monthly check-in",
      "Send recap & next-month plan",
    ],
  },
  {
    id: "ads_email",
    label: "OBM Visibility & Growth — Ads + Email",
    defaultJobName: "Ads + Email — Monthly cycle",
    description: "R18,500/mo · Ads + 2 newsletters/mo",
    tasks: [
      "Audit website & strategy",
      "Set up/optimise Meta ads",
      "Plan 2 monthly newsletters",
      "Write & design newsletter 1",
      "Write & design newsletter 2",
      "Schedule newsletters",
      "Optimise social profiles",
      "Monitor ads weekly",
      "Run 60-min monthly check-in & strategy call",
      "Send recap & next-month plan",
    ],
  },
  {
    id: "ads_email_social",
    label: "OBM Visibility & Growth — Ads + Email + Social",
    defaultJobName: "Full Service — Monthly cycle",
    description: "R25,000/mo · Ads + 4 newsletters + 16 posts/mo + automation",
    tasks: [
      "Strategy: confirm monthly content pillars",
      "Set up/optimise Meta ads",
      "Plan 4 weekly newsletters",
      "Write & design newsletter 1",
      "Write & design newsletter 2",
      "Write & design newsletter 3",
      "Write & design newsletter 4",
      "Plan 16 social posts",
      "Create/source assets for 16 posts",
      "Write captions for 16 posts",
      "Schedule 16 posts (weekly cadence)",
      "Set up/maintain email automation flows",
      "Website maintenance (min 2 hrs)",
      "Monitor ads weekly",
      "Run 60-min monthly check-in",
      "Send monthly recap",
    ],
  },
  {
    id: "full_funnel",
    label: "Full Funnel Build",
    defaultJobName: "Full Funnel Build",
    description: "R32,500+ one-time · Sales pages + email automation + ads",
    tasks: [
      "Discovery & funnel strategy session",
      "Map funnel architecture",
      "Write sales page copy",
      "Design sales page",
      "Build sales page in Ghutte",
      "Build thank-you / OTO page",
      "Set up checkout & payment integration",
      "Write email automation sequence",
      "Build email automation in Ghutte",
      "Set up Meta ads campaigns",
      "QA full funnel end-to-end",
      "Client walkthrough & training",
      "Launch funnel",
      "Post-launch optimisation review",
    ],
  },
];

export function getJobTemplate(id: string | null | undefined): JobTemplate | null {
  if (!id) return null;
  return JOB_TEMPLATES.find((t) => t.id === id) ?? null;
}
