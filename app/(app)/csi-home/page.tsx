import { createClient } from "@/lib/supabase/server";
import type { Asset, Profile, Sop, VaultLink } from "@/lib/types";
import CsiHome from "./csi-home";

export default async function CsiHomePage() {
  const supabase = await createClient();
  const [assetsRes, sopsRes, vaultRes, profilesRes] = await Promise.all([
    supabase.from("assets").select("*").order("name"),
    supabase.from("sops").select("*").order("category").order("title"),
    supabase.from("vault_links").select("*").order("label"),
    supabase.from("profiles").select("*").order("name"),
  ]);

  return (
    <CsiHome
      assets={(assetsRes.data ?? []) as Asset[]}
      sops={(sopsRes.data ?? []) as Sop[]}
      vaultLinks={(vaultRes.data ?? []) as VaultLink[]}
      profiles={(profilesRes.data ?? []) as Profile[]}
    />
  );
}
