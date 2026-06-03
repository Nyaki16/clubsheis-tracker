import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Asset,
  LeaveRequest,
  Profile,
  Sop,
  VaultLink,
} from "@/lib/types";
import CsiHome from "./csi-home";

export default async function CsiHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .single();
  const isAdmin = !!me?.is_admin;

  const [assetsRes, sopsRes, vaultRes, profilesRes, pendingLeaveRes] =
    await Promise.all([
      supabase.from("assets").select("*").order("name"),
      supabase.from("sops").select("*").order("category").order("title"),
      supabase.from("vault_links").select("*").order("label"),
      supabase.from("profiles").select("*").order("name"),
      isAdmin
        ? supabase
            .from("leave_requests")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

  return (
    <CsiHome
      assets={(assetsRes.data ?? []) as Asset[]}
      sops={(sopsRes.data ?? []) as Sop[]}
      vaultLinks={(vaultRes.data ?? []) as VaultLink[]}
      profiles={(profilesRes.data ?? []) as Profile[]}
      pendingLeave={(pendingLeaveRes.data ?? []) as LeaveRequest[]}
      viewer={{ id: user.id, isAdmin }}
    />
  );
}
