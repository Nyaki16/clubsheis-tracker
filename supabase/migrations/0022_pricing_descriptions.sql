-- What each pricing tier includes. The proposal generator reads these to pick
-- tiers and write each card's deliverables (previously hard-coded in the
-- Client Flow app's generate-proposal route). Editable on Settings → Pricing.
-- Safe to re-run: only fills descriptions that are still empty.

alter table pricing_tiers
  add column if not exists description text not null default '';

update pricing_tiers set description = v.description
from (values
  ('Small Business · Bronze',
   'Monthly access to Ghutte (our all-in-one marketing platform). Video tutorials and monthly 1-hour strategy sessions. Best for: clients who want to run their own marketing with guidance.'),
  ('Small Business · Silver',
   'Platform access + 30-minute strategy calls. Unlimited platforms. Design/post creation: 12 feed posts monthly (4 reels, 8 static). Excludes paid ads. Best for: clients who need content creation support.'),
  ('Small Business · Gold / OBM',
   'System workflow strategy. Ghutte migration. System building: sales workflows, email, social integration, ads setup. Personal training. Best for: clients who need their entire system built and optimised.'),
  ('OBM Growth Support',
   'META ads management per product category. Website audits. Social media optimisation. List management. Email automation setup. Monthly check-in calls. Best for: clients ready to scale with ads and automation.'),
  ('OBM Visibility & Growth · Ads + Email',
   'META ads management. 2 monthly newsletters. Social optimisation. Website updates. Email automation. 60-minute monthly calls (check-in and strategy). Best for: clients who want ads + email marketing managed.'),
  ('OBM Visibility & Growth · Full',
   'Meta ads management. 4 monthly newsletters. 16 weekly social posts. Email automation. Website optimisation. Dual 60-minute monthly calls. Best for: clients who want everything managed end-to-end.'),
  ('Custom Full Funnel Build',
   'Sales pages, email automation, ads setup. Personalised pricing based on scope. Best for: clients launching a new product/offer who need a complete funnel.'),
  ('Ghutte Page Build',
   'A single page built and connected inside Ghutte.'),
  ('Ghutte Monthly Subscription',
   'Monthly Ghutte platform subscription.'),
  ('Ghutte Premium Monthly Subscription',
   'Premium monthly Ghutte platform subscription.')
) as v(name, description)
where pricing_tiers.name = v.name and pricing_tiers.description = '';

notify pgrst, 'reload schema';
