import { createClient } from "@/lib/supabase/server";
import type { FlowTemplate } from "@/lib/flow";
import type { Profile } from "@/lib/types";
import TemplatesEditor from "./templates-editor";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const [templatesRes, profilesRes] = await Promise.all([
    supabase.from("flow_templates").select("*").order("position"),
    supabase.from("profiles").select("*").order("name"),
  ]);
  return (
    <TemplatesEditor
      templates={(templatesRes.data ?? []) as FlowTemplate[]}
      profiles={(profilesRes.data ?? []) as Profile[]}
      migrated={!templatesRes.error}
    />
  );
}
