import type { SupabaseClient } from "@supabase/supabase-js";
import { PACKAGES, SETUP_PHASES, setKnownPackages, type PackageDef } from "./flow";

/** The live package list with template sizes, falling back to the original six before 0026 runs. */
export async function loadPackages(sb: SupabaseClient): Promise<PackageDef[]> {
  const [{ data, error }, { data: rows }] = await Promise.all([
    sb.from("packages").select("id, label, short, description, builtin, job_name").order("position").order("created_at"),
    sb.from("flow_templates").select("package, phase"),
  ]);
  const base = error || !data?.length ? PACKAGES : (data as PackageDef[]);
  const list = base.map((p) => {
    const mine = (rows ?? []).filter((r) => r.package === p.id);
    return { ...p, tasks: mine.length, work: mine.filter((r) => !(SETUP_PHASES as readonly string[]).includes(r.phase)).length };
  });
  setKnownPackages(list);
  return list;
}
