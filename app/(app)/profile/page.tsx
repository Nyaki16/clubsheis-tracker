import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import ProfileForm from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-1">Your profile</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        Update your name, picture, and password.
      </p>
      <ProfileForm profile={profile as Profile} />
    </div>
  );
}
