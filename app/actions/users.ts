"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

// ── My profile (the signed-in user) ─────────────────────────────────────

export type ProfileUpdate = {
  name?: string;
  avatar_url?: string | null;
};

export async function updateMyProfile(updates: ProfileUpdate): Promise<InviteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) {
    const next = updates.name.trim();
    if (!next) return { ok: false, message: "Name can't be blank." };
    payload.name = next;
  }
  if (updates.avatar_url !== undefined) {
    payload.avatar_url = updates.avatar_url;
  }
  if (Object.keys(payload).length === 0) return { ok: true, message: "Nothing to update." };

  const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/profile");
  revalidatePath("/team");
  revalidatePath("/daily");
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  return { ok: true, message: "Saved." };
}

export async function updateMyPassword(newPassword: string): Promise<InviteResult> {
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, message: error.message };

  return { ok: true, message: "Password updated." };
}

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// Upload avatar via the admin client so we don't need storage RLS policies
// (Supabase's modern projects don't let postgres role manage policies on
// storage.objects via SQL Editor — admin client bypasses them cleanly).
export async function uploadMyAvatar(formData: FormData): Promise<InviteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "No file received." };
  }
  if (file.size === 0) return { ok: false, message: "File is empty." };
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, message: "File is bigger than 5 MB." };
  }
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return { ok: false, message: "Only JPG, PNG, WebP, or GIF." };
  }

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: true,
    });
  if (upErr) return { ok: false, message: upErr.message };

  const { data: pub } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: updErr } = await admin
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", user.id);
  if (updErr) return { ok: false, message: updErr.message };

  revalidatePath("/profile");
  revalidatePath("/team");
  revalidatePath("/daily");
  revalidatePath("/dashboard");
  revalidatePath("/clients");

  return { ok: true, message: url };
}

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

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit") || msg.includes("rate-limit")) {
      return {
        ok: false,
        message:
          "Supabase's built-in invite email is rate-limited (3/hour on the free tier). Use \"Generate invite link\" instead and DM it to them.",
      };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/team");
  return {
    ok: true,
    message: `Invite sent to ${cleanEmail}. They'll get an email to set their password.`,
  };
}

// Email-free fallback: creates the auth user (or reuses an existing one) and
// returns a one-time invite/recovery link the admin can copy + DM. Bypasses
// the Supabase invite-email rate limit entirely.
export type InviteLinkResult =
  | { ok: true; link: string; email: string }
  | { ok: false; message: string };

export async function generateInviteLink(
  name: string,
  email: string
): Promise<InviteLinkResult> {
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
  const redirectTo = origin ? `${origin}/auth/callback?next=/welcome` : undefined;

  const admin = createAdminClient();

  // Try invite-type link first (creates the user if new). If the user already
  // exists Supabase returns an "already registered" error — fall back to a
  // recovery link so they can set/reset their password.
  let link: string | null = null;

  const inviteRes = await admin.auth.admin.generateLink({
    type: "invite",
    email: cleanEmail,
    options: { data: { name: cleanName }, redirectTo },
  });

  if (inviteRes.data?.properties?.action_link) {
    link = inviteRes.data.properties.action_link;
  } else if (inviteRes.error) {
    const msg = inviteRes.error.message.toLowerCase();
    const alreadyRegistered =
      msg.includes("already") || msg.includes("registered");
    if (!alreadyRegistered) {
      return { ok: false, message: inviteRes.error.message };
    }
    const recoveryRes = await admin.auth.admin.generateLink({
      type: "recovery",
      email: cleanEmail,
      options: { redirectTo },
    });
    if (recoveryRes.error) {
      return { ok: false, message: recoveryRes.error.message };
    }
    link = recoveryRes.data?.properties?.action_link ?? null;
  }

  if (!link) return { ok: false, message: "Could not generate a link." };

  revalidatePath("/team");
  return { ok: true, link, email: cleanEmail };
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
