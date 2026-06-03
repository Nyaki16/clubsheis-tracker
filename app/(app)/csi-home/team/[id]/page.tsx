import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LeaveRequest, Profile } from "@/lib/types";
import PersonDetail from "./person-detail";

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .single();
  const isAdmin = !!myProfile?.is_admin;
  const isSelf = user.id === id;
  if (!isAdmin && !isSelf) {
    // Non-admins can only view their own profile.
    redirect(`/csi-home/team/${user.id}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (!profile) notFound();

  // Leave requests for this person (sorted newest first).
  const { data: leave } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("requester_id", id)
    .order("created_at", { ascending: false });

  return (
    <PersonDetail
      profile={profile as Profile}
      leave={(leave ?? []) as LeaveRequest[]}
      viewer={{ id: user.id, isAdmin, isSelf }}
    />
  );
}
