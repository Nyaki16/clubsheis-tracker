"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  LeaveRequestInput,
  LeaveStatus,
  ProfileFields,
} from "@/lib/types";

export type InviteResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

// ── Auth helpers ─────────────────────────────────────────────────────────

async function getMe() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return { id: user.id, isAdmin: !!profile.is_admin };
}

// ── Personal info (any field on a profile) ───────────────────────────────

const PROFILE_FIELD_KEYS: (keyof ProfileFields)[] = [
  "name",
  "surname",
  "cellphone",
  "home_address",
  "next_of_kin",
  "next_of_kin_phone",
  "id_document_url",
  "job_title",
  "start_date",
  "annual_leave_allowance",
];

export async function updateProfileFields(
  profileId: string,
  fields: ProfileFields
): Promise<InviteResult> {
  const me = await getMe();
  if (!me) return { ok: false, message: "Not signed in." };
  if (me.id !== profileId && !me.isAdmin) {
    return { ok: false, message: "You can only edit your own profile." };
  }

  const payload: Record<string, unknown> = {};
  for (const k of PROFILE_FIELD_KEYS) {
    if (fields[k] === undefined) continue;
    const v = fields[k];
    if (typeof v === "string") payload[k] = v.trim() || null;
    else payload[k] = v;
  }
  // name must never be blank
  if (payload.name !== undefined && !payload.name) {
    return { ok: false, message: "Name can't be blank." };
  }
  // annual_leave_allowance must be a non-negative integer
  if (payload.annual_leave_allowance !== undefined) {
    const n = Number(payload.annual_leave_allowance);
    if (Number.isNaN(n) || n < 0) {
      return { ok: false, message: "Leave allowance must be 0 or more." };
    }
    if (!me.isAdmin) {
      // only admins can edit allowance
      delete payload.annual_leave_allowance;
    } else {
      payload.annual_leave_allowance = Math.round(n);
    }
  }
  if (Object.keys(payload).length === 0) {
    return { ok: true, message: "Nothing to update." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update(payload)
    .eq("id", profileId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/csi-home");
  revalidatePath(`/csi-home/team/${profileId}`);
  revalidatePath("/team");
  revalidatePath("/profile");
  return { ok: true, message: "Saved." };
}

// ── ID document upload ───────────────────────────────────────────────────

const ID_BUCKET = "avatars"; // reusing the existing public bucket for now
const MAX_ID_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ID_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export async function uploadIdDocument(
  profileId: string,
  formData: FormData
): Promise<InviteResult> {
  const me = await getMe();
  if (!me) return { ok: false, message: "Not signed in." };
  if (me.id !== profileId && !me.isAdmin) {
    return { ok: false, message: "You can only upload your own ID." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "No file received." };
  }
  if (file.size === 0) return { ok: false, message: "File is empty." };
  if (file.size > MAX_ID_BYTES) {
    return { ok: false, message: "File is bigger than 10 MB." };
  }
  if (!ALLOWED_ID_TYPES.has(file.type)) {
    return { ok: false, message: "Only JPG, PNG, WebP, GIF or PDF." };
  }

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${profileId}/id-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from(ID_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: true,
    });
  if (upErr) return { ok: false, message: upErr.message };

  const { data: pub } = admin.storage.from(ID_BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: updErr } = await admin
    .from("profiles")
    .update({ id_document_url: url })
    .eq("id", profileId);
  if (updErr) return { ok: false, message: updErr.message };

  revalidatePath("/csi-home");
  revalidatePath(`/csi-home/team/${profileId}`);
  return { ok: true, message: url };
}

// ── Leave requests ───────────────────────────────────────────────────────

export async function createLeaveRequest(
  input: LeaveRequestInput
): Promise<InviteResult> {
  const me = await getMe();
  if (!me) return { ok: false, message: "Not signed in." };

  const start = input.start_date;
  const end = input.end_date;
  if (!start || !end) return { ok: false, message: "Pick both dates." };
  if (end < start) {
    return { ok: false, message: "End date can't be before start date." };
  }
  const days = Number(input.days);
  if (!days || days <= 0) {
    return { ok: false, message: "Days must be greater than 0." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("leave_requests").insert({
    requester_id: me.id,
    start_date: start,
    end_date: end,
    days,
    reason: (input.reason ?? "").trim(),
    status: "pending",
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/csi-home");
  revalidatePath(`/csi-home/team/${me.id}`);
  return { ok: true, message: "Leave request sent." };
}

export async function decideLeaveRequest(
  id: string,
  decision: "approved" | "rejected",
  notes: string
): Promise<InviteResult> {
  const me = await getMe();
  if (!me) return { ok: false, message: "Not signed in." };
  if (!me.isAdmin) {
    return { ok: false, message: "Only admins can approve or reject leave." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("leave_requests")
    .update({
      status: decision,
      approver_id: me.id,
      decided_at: new Date().toISOString(),
      decided_notes: notes.trim(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/csi-home");
  return { ok: true, message: `Leave ${decision}.` };
}

export async function cancelLeaveRequest(id: string): Promise<InviteResult> {
  const me = await getMe();
  if (!me) return { ok: false, message: "Not signed in." };

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("leave_requests")
    .select("requester_id, status")
    .eq("id", id)
    .single();
  if (fetchErr || !row) return { ok: false, message: "Request not found." };
  if (row.requester_id !== me.id && !me.isAdmin) {
    return { ok: false, message: "You can only cancel your own request." };
  }
  if (row.status !== "pending") {
    return { ok: false, message: "Only pending requests can be cancelled." };
  }

  const { error } = await admin
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/csi-home");
  return { ok: true, message: "Request cancelled." };
}

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
