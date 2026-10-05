import { createClient } from "@/lib/supabase/server";
import type { PricingTier } from "@/lib/flow";
import PricingEditor from "./pricing-editor";

export default async function PricingPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pricing_tiers").select("*").order("position");
  return <PricingEditor tiers={(data ?? []) as PricingTier[]} migrated={!error} />;
}
