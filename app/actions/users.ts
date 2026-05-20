"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) throw new Error("Only admins can do this.");
  return user;
}

export async function inviteUser(name: string, email: string): Promise<InviteResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Forbidden." };
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanName) return { ok: false, message: "Name is required." };
  if (!cleanEmail) return { ok: false, message: "Email is required." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(cleanEmail, {
    data: { name: cleanName },
    redirectTo: origin ? `${origin}/auth/callback?next=/welcome` : undefined,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/team");
  return {
    ok: true,
    message: `Invite sent to ${cleanEmail}. They'll get an email to set their password.`,
  };
}

export async function reinviteUser(profileId: string): Promise<InviteResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Forbidden." };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("email, name")
    .eq("id", profileId)
    .single();
  if (profileErr || !profile?.email) {
    return { ok: false, message: "Could not find that user." };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  const { error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: profile.email,
    options: {
      redirectTo: origin ? `${origin}/auth/callback?next=/welcome` : undefined,
    },
  });

  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message: `Reset link sent to ${profile.email}. They can set a new password from the email.`,
  };
}

export async function setIsAdmin(profileId: string, isAdmin: boolean): Promise<InviteResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Forbidden." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", profileId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/team");
  return { ok: true, message: isAdmin ? "Promoted to admin." : "Demoted." };
}
