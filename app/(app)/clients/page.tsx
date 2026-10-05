import { createClient } from "@/lib/supabase/server";
import { loadFlowData } from "@/lib/flow-data";
import FlowClientsList, { type ClientsGroup } from "./flow-clients-list";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ view?: string; group?: string }> }) {
  const { view, group } = await searchParams;
  const supabase = await createClient();
  const data = await loadFlowData(supabase);
  return (
    <FlowClientsList
      {...data}
      initialView={view === "list" ? "list" : "grid"}
      initialGroup={(["phase", "package", "none"] as const).find((g) => g === group) ?? ("phase" as ClientsGroup)}
    />
  );
}
