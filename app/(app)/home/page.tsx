import { createClient } from "@/lib/supabase/server";
import { loadFlowData } from "@/lib/flow-data";
import HomeClient from "./home-client";

export default async function HomePage() {
  const supabase = await createClient();
  const data = await loadFlowData(supabase);
  return <HomeClient {...data} />;
}
