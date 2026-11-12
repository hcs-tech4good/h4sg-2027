"use server";

import { z } from "zod";
import { H4SG_FIELDS, validateH4sgDetails } from "@/lib/h4sg-application";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { emailConfigured, sendAnnouncementEmails, sendDecisionUpdateEmails } from "@/lib/email";
import { ATTENDANCE_OPTIONS, STARTUP_STAGE_OPTIONS } from "@/data";
import { ANNOUNCEMENT_CONTENT_MAX, ANNOUNCEMENT_TITLE_MAX } from "@/lib/announcement-limits";
import type { ResumeFile, ResumeScope } from "@/lib/resume-zip";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    throw new Error("Unauthorized: admin access required");
  }

  return user;
}

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "reviewer")) {
    throw new Error("Unauthorized: staff access required");
  }

  return user;
}

export async function validateInviteToken(tokenId: string) {
  const supabase = createAdminClient();

  const { data: token, error } = await supabase
    .from("invite_tokens")
    .select("*")
    .eq("id", tokenId)
    .single();

  if (error || !token) {
    return { valid: false, error: "Invalid token" };
  }

  if (new Date(token.expires_at) < new Date()) {
    return { valid: false, error: "Token has expired" };
  }

  if (token.consumable && token.consumers && token.consumers.length > 0) {
    return { valid: false, error: "Token has already been used" };
  }

  return { valid: true, role: token.role as "reviewer" | "admin" };
}

// A profile is always created as an applicant. Staff privileges can only
// be granted afterwards via a valid invite token (claimStaffRole) or by an
// existing admin. The client can NEVER choose its own role here.
export async function createProfile(
  userId: string,
  firstName: string,
  lastName: string,
  hhid: string
) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("profiles").insert({
    id: userId,
    first_name: firstName,
    last_name: lastName,
    hhid,
    role: "applicant",
  });

  if (error) {
    if (error.code === "23505") {
      return { success: true };
    }
    throw new Error("Failed to create profile: " + error.message);
  }

  return { success: true };
}

// Grants staff role to a freshly-created account using a valid invite token.
// Authorization is the possession of an unconsumed, unexpired token (a secret
// UUID created by an admin) — mirroring the old portal's token signup model.
export async function claimStaffRole(userId: string, tokenId: string) {
  const supabase = createAdminClient();

  const { data: token } = await supabase
    .from("invite_tokens")
    .select("*")
    .eq("id", tokenId)
    .single();

  if (!token) throw new Error("Invalid invite token");
  if (new Date(token.expires_at) < new Date())
    throw new Error("Invite token has expired");
  if (token.consumable && token.consumers && token.consumers.length > 0)
    throw new Error("Invite token has already been used");

  await supabase
    .from("profiles")
    .update({ role: token.role })
    .eq("id", userId);

  const consumers = [...(token.consumers || []), userId];
  await supabase
    .from("invite_tokens")
    .update({ consumers })
    .eq("id", tokenId);

  return { success: true };
}

export async function setUserRole(userId: string, role: "applicant" | "reviewer" | "admin") {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("profiles").update({ role }).eq("id", userId);
}

export async function promoteUserByEmail(email: string, role: "reviewer" | "admin") {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("promote_user_by_email", {
    target_email: email,
    new_role: role,
  });

  if (error) {
    throw new Error(`Could not find user with email: ${email}`);
  }

  return { success: true };
}

export async function deleteUserAccount(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) throw new Error("Unauthorized");

  const admin = createAdminClient();

  // The shared check-in station account must not be able to delete itself.
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (profile?.role === "checkin") throw new Error("This account can't be deleted.");

  await admin.from("applications").delete().eq("id", userId);
  await admin.from("decisions").delete().eq("id", userId);
  await admin.from("confirmations").delete().eq("id", userId);
  await admin.from("checkins").delete().eq("id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);

  return { success: true };
}

export async function submitApplication(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) throw new Error("Unauthorized");

  const DEADLINE = new Date(process.env.NEXT_PUBLIC_APP_CLOSES || 0);
  if (new Date() > DEADLINE) {
    throw new Error("Application deadline has passed");
  }

  const { data: app } = await supabase
    .from("applications")
    .select("submitted, resume_url, h4sg_details, phone, school, major, age")
    .eq("id", userId)
    .single();

  if (!app) throw new Error("Application not found");
  if (app.submitted) throw new Error("Application already submitted");
  if (!app.resume_url) throw new Error("Resume required");

  const additional = validateH4sgDetails(app.h4sg_details);
  if (additional.error) throw new Error(additional.error);
  if (!app.phone?.trim() || !app.school?.trim() || !app.major?.trim()) {
    throw new Error("Phone number, university, and major are required.");
  }
  if (app.age !== null && app.age < 18) throw new Error("You must be 18 or older to participate.");

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("applications")
    .update({
      submitted: true,
      submitted_at: new Date().toISOString(),
      resume_share: additional.details?.sponsor_sharing === "Yes",
      able_to_attend: additional.details?.full_attendance === "Yes",
      // validateH4sgDetails requires agreeing to the event Code of Conduct.
      code_of_conduct: true,
    })
    .eq("id", userId)
    .eq("submitted", false);

  if (error) throw new Error("Failed to submit application");
  return { success: true };
}

export async function makeDecision(
  applicantId: string,
  type: "accepted" | "waitlisted" | "rejected"
): Promise<{ success: true } | { success: false; error: string }> {
  const staff = await requireStaff();
  const supabase = createAdminClient();
  const decidedAt = new Date().toISOString();

  // Only ever touch a decision that is still staged; a released decision is
  // visible to the applicant and must not be silently changed or un-released.
  const { data: updated, error: updateError } = await supabase
    .from("decisions")
    .update({ type, decided_by: staff.id, decided_at: decidedAt })
    .eq("id", applicantId)
    .eq("released", false)
    .select("id");
  if (updateError) return { success: false, error: "Failed to save decision." };
  if (updated && updated.length > 0) return { success: true };

  const { error: insertError } = await supabase.from("decisions").insert({
    id: applicantId,
    type,
    released: false,
    decided_by: staff.id,
    decided_at: decidedAt,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return { success: false, error: "This decision has already been released. Refresh the page to change it." };
    }
    return { success: false, error: "Failed to save decision." };
  }

  return { success: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RELEASE_PER_CALL = 5000;

// Changes the decision of an applicant whose result is already released, then
// emails them the update. Note: the email step sends every released decision
// that is still pending, which is normally only this applicant.
export async function changeReleasedDecision(
  applicantId: string,
  type: "accepted" | "waitlisted" | "rejected"
): Promise<
  | { ok: true; changed: boolean; emailed: number; emailError?: string }
  | { ok: false; error: string }
> {
  const staff = await requireStaff();
  if (typeof applicantId !== "string" || !UUID_RE.test(applicantId)) {
    return { ok: false, error: "Invalid applicant." };
  }
  if (type !== "accepted" && type !== "waitlisted" && type !== "rejected") {
    return { ok: false, error: "Invalid decision." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("change_released_decision", {
    p_id: applicantId,
    p_type: type,
    p_changed_by: staff.id,
  });
  if (error) {
    console.error("change_released_decision failed", error);
    if (String(error.message ?? "").includes("not released")) {
      return { ok: false, error: "This decision isn't released yet. Use the staged buttons to change it." };
    }
    return { ok: false, error: "Couldn't change the decision. Nothing was changed." };
  }

  // The RPC returns the previous type, or null when the type was already `type`.
  if (data === null) return { ok: true, changed: false, emailed: 0 };

  const email = await sendPendingNotifications();
  return {
    ok: true,
    changed: true,
    emailed: email.sent,
    emailError: email.error,
  };
}

// Changes many released decisions to one new type in a single transaction.
// Emails are sent separately by sendPendingNotifications, like a release.
export async function changeReleasedDecisions(
  applicantIds: string[],
  type: "accepted" | "waitlisted" | "rejected"
): Promise<{ ok: true; changed: number; skipped: number } | { ok: false; error: string }> {
  const staff = await requireStaff();

  if (type !== "accepted" && type !== "waitlisted" && type !== "rejected") {
    return { ok: false, error: "Invalid decision." };
  }
  const ids = Array.isArray(applicantIds)
    ? Array.from(new Set(applicantIds.filter((id) => typeof id === "string" && UUID_RE.test(id))))
    : [];
  if (ids.length === 0) return { ok: false, error: "No applicants selected." };
  if (ids.length > MAX_RELEASE_PER_CALL) {
    return { ok: false, error: `Select at most ${MAX_RELEASE_PER_CALL} applicants at a time.` };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("change_released_decisions", {
    p_ids: ids,
    p_type: type,
    p_changed_by: staff.id,
  });
  if (error) {
    console.error("change_released_decisions failed", error);
    return { ok: false, error: "Couldn't change the decisions. Nothing was changed." };
  }

  const changed = typeof data === "number" ? data : 0;
  return { ok: true, changed, skipped: ids.length - changed };
}

// Atomically releases every selected decision that is still staged and writes
// one audit record, all inside a single database function. Emails are sent
// separately by sendPendingNotifications so a mail outage never blocks a release.
export async function releaseDecisions(
  decisionIds: string[]
): Promise<{ ok: true; released: number; skipped: number } | { ok: false; error: string }> {
  const staff = await requireStaff();

  const ids = Array.isArray(decisionIds)
    ? Array.from(new Set(decisionIds.filter((id) => typeof id === "string" && UUID_RE.test(id))))
    : [];
  if (ids.length === 0) return { ok: false, error: "No decisions selected." };
  if (ids.length > MAX_RELEASE_PER_CALL) {
    return { ok: false, error: `Select at most ${MAX_RELEASE_PER_CALL} decisions at a time.` };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("release_decisions", {
    p_ids: ids,
    p_released_by: staff.id,
  });
  if (error) {
    console.error("release_decisions failed", error);
    return { ok: false, error: "Failed to release decisions. Nothing was changed." };
  }

  const released = typeof data === "number" ? data : 0;
  return { ok: true, released, skipped: ids.length - released };
}

export interface NotifyResult {
  ok: boolean;
  configured: boolean;
  sent: number;
  failed: number;
  remaining: number;
  error?: string;
}

const NOTIFY_BATCH_SIZE = 50;

async function countPendingNotifications(supabase: ReturnType<typeof createAdminClient>) {
  const { count } = await supabase
    .from("decisions")
    .select("*", { count: "exact", head: true })
    .eq("released", true)
    .is("notified_at", null)
    .is("notify_error", null);
  return count ?? 0;
}

// Emails one bounded batch of released-but-unemailed applicants. The client
// calls this repeatedly until `remaining` is 0 (or no progress is made), so it
// is safe to interrupt and resume, and two admins can't double-send.
export async function sendPendingNotifications(opts?: {
  retryFailed?: boolean;
}): Promise<NotifyResult> {
  await requireStaff();
  const supabase = createAdminClient();

  if (!emailConfigured()) {
    return {
      ok: false,
      configured: false,
      sent: 0,
      failed: 0,
      remaining: await countPendingNotifications(supabase),
      error: "Email isn't configured (POSTMARK_API_TOKEN). Nobody has been emailed.",
    };
  }

  if (opts?.retryFailed) {
    await supabase
      .from("decisions")
      .update({ notify_error: null })
      .eq("released", true)
      .is("notified_at", null)
      .not("notify_error", "is", null);
  }

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_pending_notifications",
    { p_limit: NOTIFY_BATCH_SIZE }
  );
  if (claimError) {
    console.error("claim_pending_notifications failed", claimError);
    return {
      ok: false,
      configured: true,
      sent: 0,
      failed: 0,
      remaining: await countPendingNotifications(supabase),
      error: "Couldn't load the next batch of applicants to email.",
    };
  }

  const rows = (claimed ?? []) as { id: string; email: string | null; first_name: string | null }[];
  if (rows.length === 0) {
    return { ok: true, configured: true, sent: 0, failed: 0, remaining: 0 };
  }

  const releaseClaims = async (ids: string[]) => {
    if (ids.length === 0) return;
    await supabase.from("decisions").update({ notified_at: null }).in("id", ids);
  };

  let result;
  try {
    result = await sendDecisionUpdateEmails(
      rows.map((r) => ({ id: r.id, email: r.email, firstName: r.first_name }))
    );
  } catch (e) {
    console.error("sendDecisionUpdateEmails threw", e);
    await releaseClaims(rows.map((r) => r.id));
    return {
      ok: false,
      configured: true,
      sent: 0,
      failed: 0,
      remaining: await countPendingNotifications(supabase),
      error: "Unexpected error while sending emails. Nothing was marked as sent.",
    };
  }

  await releaseClaims(result.retry);
  await Promise.all(
    result.failed.map((f) =>
      supabase
        .from("decisions")
        .update({ notified_at: null, notify_error: f.error.slice(0, 500) })
        .eq("id", f.id)
    )
  );

  return {
    ok: !result.error,
    configured: true,
    sent: result.sent.length,
    failed: result.failed.length,
    remaining: await countPendingNotifications(supabase),
    error: result.error
      ? `Email provider error: ${result.error}`
      : undefined,
  };
}

// Posts an announcement and queues one email per accepted (released)
// applicant. Emails are sent separately by sendAnnouncementEmailBatch so a mail
// outage never blocks posting.
export async function createAnnouncement(input: {
  title: string;
  content: string;
}): Promise<
  | { ok: true; id: string; queued: number; queueError?: string }
  | { ok: false; error: string }
> {
  const admin = await requireAdmin();

  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const content = typeof input?.content === "string" ? input.content.trim() : "";
  if (!title) return { ok: false, error: "Please enter a title." };
  if (!content) return { ok: false, error: "Please enter the announcement content." };
  if (title.length > ANNOUNCEMENT_TITLE_MAX) {
    return { ok: false, error: `Title must be ${ANNOUNCEMENT_TITLE_MAX} characters or fewer.` };
  }
  if (content.length > ANNOUNCEMENT_CONTENT_MAX) {
    return { ok: false, error: `Content must be ${ANNOUNCEMENT_CONTENT_MAX} characters or fewer.` };
  }

  const supabase = createAdminClient();
  const { data: created, error } = await supabase
    .from("announcements")
    .insert({ title, content, created_by: admin.id })
    .select("id")
    .single();
  if (error || !created) {
    console.error("createAnnouncement insert failed", error);
    return { ok: false, error: "Failed to post the announcement. Nothing was posted." };
  }

  const { data: queued, error: queueError } = await supabase.rpc("queue_announcement_emails", {
    p_announcement_id: created.id,
  });
  if (queueError) {
    console.error("queue_announcement_emails failed", queueError);
    return {
      ok: true,
      id: created.id,
      queued: 0,
      queueError: "The announcement was posted, but the emails couldn't be queued, so nobody was emailed.",
    };
  }

  return { ok: true, id: created.id, queued: typeof queued === "number" ? queued : 0 };
}

async function countAnnouncementEmails(
  supabase: ReturnType<typeof createAdminClient>,
  announcementId: string
) {
  const { count } = await supabase
    .from("announcement_emails")
    .select("*", { count: "exact", head: true })
    .eq("announcement_id", announcementId)
    .is("sent_at", null)
    .is("error", null);
  return count ?? 0;
}

// Emails one bounded batch of an announcement's queued recipients. The client
// calls this repeatedly until `remaining` is 0, so it is safe to interrupt and
// resume, and two admins can't double-send.
export async function sendAnnouncementEmailBatch(
  announcementId: string,
  opts?: { retryFailed?: boolean }
): Promise<NotifyResult> {
  await requireAdmin();
  const none = { sent: 0, failed: 0, remaining: 0 };
  if (typeof announcementId !== "string" || !UUID_RE.test(announcementId)) {
    return { ok: false, configured: true, ...none, error: "Invalid announcement." };
  }

  const supabase = createAdminClient();

  if (!emailConfigured()) {
    return {
      ok: false,
      configured: false,
      sent: 0,
      failed: 0,
      remaining: await countAnnouncementEmails(supabase, announcementId),
      error: "Email isn't configured (POSTMARK_API_TOKEN). Nobody has been emailed.",
    };
  }

  const { data: announcement } = await supabase
    .from("announcements")
    .select("title")
    .eq("id", announcementId)
    .maybeSingle();
  if (!announcement) {
    return { ok: false, configured: true, ...none, error: "Announcement not found." };
  }

  if (opts?.retryFailed) {
    await supabase
      .from("announcement_emails")
      .update({ error: null })
      .eq("announcement_id", announcementId)
      .is("sent_at", null)
      .not("error", "is", null);
  }

  const { data: claimed, error: claimError } = await supabase.rpc("claim_announcement_emails", {
    p_announcement_id: announcementId,
    p_limit: NOTIFY_BATCH_SIZE,
  });
  if (claimError) {
    console.error("claim_announcement_emails failed", claimError);
    return {
      ok: false,
      configured: true,
      sent: 0,
      failed: 0,
      remaining: await countAnnouncementEmails(supabase, announcementId),
      error: "Couldn't load the next batch of recipients to email.",
    };
  }

  const rows = (claimed ?? []) as { user_id: string; email: string | null; first_name: string | null }[];
  if (rows.length === 0) {
    return { ok: true, configured: true, ...none };
  }

  const releaseClaims = async (ids: string[]) => {
    if (ids.length === 0) return;
    await supabase
      .from("announcement_emails")
      .update({ sent_at: null })
      .eq("announcement_id", announcementId)
      .in("user_id", ids);
  };

  let result;
  try {
    result = await sendAnnouncementEmails(
      rows.map((r) => ({ id: r.user_id, email: r.email, firstName: r.first_name })),
      announcement.title
    );
  } catch (e) {
    console.error("sendAnnouncementEmails threw", e);
    await releaseClaims(rows.map((r) => r.user_id));
    return {
      ok: false,
      configured: true,
      sent: 0,
      failed: 0,
      remaining: await countAnnouncementEmails(supabase, announcementId),
      error: "Unexpected error while sending emails. Nothing was marked as sent.",
    };
  }

  await releaseClaims(result.retry);
  await Promise.all(
    result.failed.map((f) =>
      supabase
        .from("announcement_emails")
        .update({ sent_at: null, error: f.error.slice(0, 500) })
        .eq("announcement_id", announcementId)
        .eq("user_id", f.id)
    )
  );

  return {
    ok: !result.error,
    configured: true,
    sent: result.sent.length,
    failed: result.failed.length,
    remaining: await countAnnouncementEmails(supabase, announcementId),
    error: result.error ? `Email provider error: ${result.error}` : undefined,
  };
}

const registrationSchema = z.object({
  confirmed: z.string(),
  fullName: z.string().max(200),
  email: z.string().max(254),
  buildingStartup: z.boolean().nullable(),
  startupStage: z.string().nullable(),
  waiver: z.boolean(),
  photoRelease: z.boolean(),
});

export async function submitRegistration(
  input: unknown
): Promise<{ ok: true; attending: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid submission." };
  const d = parsed.data;

  if (!ATTENDANCE_OPTIONS.includes(d.confirmed)) {
    return { ok: false, error: "Please select your attendance status." };
  }
  const attending = d.confirmed === ATTENDANCE_OPTIONS[0];

  let row: {
    id: string;
    confirmed: string;
    waiver: boolean;
    photo_release: boolean;
    full_name: string | null;
    email: string | null;
    building_startup: boolean | null;
    startup_stage: string | null;
  } = {
    id: user.id,
    confirmed: d.confirmed,
    waiver: false,
    photo_release: false,
    full_name: null,
    email: null,
    building_startup: null,
    startup_stage: null,
  };

  if (attending) {
    const fullName = d.fullName.trim();
    const email = d.email.trim();
    if (!fullName) return { ok: false, error: "Please enter your full name." };
    if (!z.email().safeParse(email).success) {
      return { ok: false, error: "Please enter a valid email address." };
    }
    if (!d.waiver) return { ok: false, error: "You must agree to the liability waiver." };
    if (
      d.startupStage !== null &&
      (d.buildingStartup !== true || !STARTUP_STAGE_OPTIONS.includes(d.startupStage))
    ) {
      return { ok: false, error: "Invalid startup stage." };
    }
    row = {
      ...row,
      waiver: true,
      photo_release: d.photoRelease,
      full_name: fullName,
      email,
      building_startup: d.buildingStartup,
      startup_stage: d.startupStage,
    };
  }

  const admin = createAdminClient();
  const { data: decision } = await admin
    .from("decisions")
    .select("type, released")
    .eq("id", user.id)
    .maybeSingle();
  if (!decision || !decision.released || decision.type !== "accepted") {
    return { ok: false, error: "Only accepted applicants can register." };
  }

  const { error } = await admin.from("confirmations").insert(row);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "You've already submitted your registration." };
    }
    console.error("submitRegistration insert failed", error);
    return { ok: false, error: "Failed to submit registration. Please try again." };
  }

  return { ok: true, attending };
}

function csvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = Array.isArray(val) ? val.join("; ") : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Full-dataset CSV export of ALL submitted applications (staff only).
// Fetches in bounded batches so it never relies on an implicit row cap and
// keeps memory proportional to one batch of joined rows at a time.
export async function exportSubmittedApplicationsCsv() {
  await requireStaff();
  const supabase = createAdminClient();

  const BATCH = 1000;

  // Pull all submitted applications in batches.
  const apps: Record<string, unknown>[] = [];
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("submitted", true)
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + BATCH - 1);
    if (error) throw new Error("Export failed while reading applications");
    if (!data || data.length === 0) break;
    apps.push(...data);
    if (data.length < BATCH) break;
  }

  // Fetch profiles + decisions for the collected ids. The ids travel in the
  // request URL, so chunks must stay small: 1000 ids overflows the URL limit
  // and the lookup fails. Any failure aborts the export rather than silently
  // producing rows with no name or decision.
  const ID_CHUNK = 200;
  const profileById = new Map<string, { first_name: string; last_name: string; hhid: string }>();
  const decisionById = new Map<string, { type: string; released: boolean }>();
  const ids = apps.map((a) => a.id as string);
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const [profiles, decisions] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name, hhid").in("id", chunk),
      supabase.from("decisions").select("id, type, released").in("id", chunk),
    ]);
    if (profiles.error || decisions.error) {
      console.error("export lookup failed", profiles.error ?? decisions.error);
      throw new Error("Export failed while reading names and decisions");
    }
    for (const p of profiles.data || []) profileById.set(p.id, p);
    for (const d of decisions.data || []) decisionById.set(d.id, d);
  }

  const columns: { header: string; get: (a: Record<string, unknown>) => unknown }[] = [
    { header: "hacker_id", get: (a) => profileById.get(a.id as string)?.hhid },
    { header: "first_name", get: (a) => profileById.get(a.id as string)?.first_name },
    { header: "last_name", get: (a) => profileById.get(a.id as string)?.last_name },
    { header: "email", get: (a) => a.email },
    { header: "decision", get: (a) => decisionById.get(a.id as string)?.type ?? "undecided" },
    { header: "decision_released", get: (a) => (decisionById.get(a.id as string)?.released ? "yes" : "no") },
    { header: "submitted_at", get: (a) => a.submitted_at },
    { header: "age", get: (a) => a.age },
    { header: "gender", get: (a) => a.gender },
    { header: "race", get: (a) => a.race },
    { header: "underrepresented", get: (a) => a.underrepresented },
    { header: "phone", get: (a) => a.phone },
    { header: "country_of_residence", get: (a) => a.country },
    { header: "address_line1", get: (a) => a.address_line1 },
    { header: "address_line2", get: (a) => a.address_line2 },
    { header: "city", get: (a) => a.city },
    { header: "state", get: (a) => a.state },
    { header: "zip", get: (a) => a.zip },
    { header: "address_country", get: (a) => a.address_country },
    { header: "dietary_restrictions", get: (a) => a.dietary_restrictions },
    { header: "dietary_other", get: (a) => a.dietary_other },
    { header: "education_level", get: (a) => a.level_of_study },
    { header: "enrolled_undergrad", get: (a) => a.enrolled },
    { header: "school", get: (a) => a.school },
    { header: "graduation_year", get: (a) => a.graduation_year },
    { header: "major", get: (a) => a.major },
    { header: "harvard_affiliated", get: (a) => a.harvard_affiliated },
    { header: "shirt_size", get: (a) => a.shirt_size },
    { header: "first_hackathon", get: (a) => a.first_hackathon },
    { header: "previously_participated", get: (a) => a.previously_participated },
    { header: "able_to_attend", get: (a) => a.able_to_attend },
    { header: "referral_source", get: (a) => a.referral_source },
    { header: "team_roles", get: (a) => a.team_roles },
    { header: "other_role", get: (a) => a.other_role },
    { header: "programming_languages", get: (a) => a.programming_languages },
    { header: "other_language", get: (a) => a.other_language },
    { header: "experience", get: (a) => a.experience },
    { header: "essay_goals", get: (a) => a.essay_why_hh },
    { header: "essay_project", get: (a) => a.essay_project },
    { header: "essay_unlimited", get: (a) => a.essay_unlimited_resource },
    { header: "essay_space", get: (a) => a.essay_space },
    { header: "financial_aid_requested", get: (a) => a.financial_aid },
    { header: "financial_aid_detail", get: (a) => a.financial_aid_detail },
    { header: "resume_share", get: (a) => a.resume_share },
    { header: "code_of_conduct", get: (a) => a.code_of_conduct },
    { header: "data_sharing", get: (a) => a.data_sharing },
    { header: "mlh_emails", get: (a) => a.mlh_emails },
    ...H4SG_FIELDS.map((field) => ({
      header: `h4sg_${field.key}`,
      get: (a: Record<string, unknown>) => (a.h4sg_details as Record<string, unknown> | null)?.[field.key],
    })),
  ];

  const headerRow = columns.map((c) => c.header).join(",");
  const rows = (apps || []).map((a) =>
    columns.map((c) => csvCell(c.get(a as Record<string, unknown>))).join(",")
  );

  return [headerRow, ...rows].join("\n");
}

const RESUME_SCOPE_VALUES: ResumeScope[] = ["shared", "accepted", "all"];
const MAX_RESUME_URLS_PER_CALL = 100;
const RESUME_URL_TTL_SECONDS = 60 * 10;

// Lists the resumes an admin is about to download (no file contents).
//   shared   = accepted + released, and agreed to share with sponsors
//   accepted = accepted + released
//   all      = every submitted application
export async function listResumesForDownload(
  scope: ResumeScope
): Promise<{ ok: true; files: ResumeFile[] } | { ok: false; error: string }> {
  const requester = await requireAdmin();
  if (!RESUME_SCOPE_VALUES.includes(scope)) return { ok: false, error: "Invalid selection." };

  const supabase = createAdminClient();
  const PAGE = 1000;
  const apps: {
    id: string;
    email: string | null;
    school: string | null;
    major: string | null;
    graduation_year: number | null;
    resume_share: boolean | null;
  }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("applications")
      .select("id, email, school, major, graduation_year, resume_share")
      .eq("submitted", true)
      .not("resume_url", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("listResumesForDownload applications failed", error);
      return { ok: false, error: "Couldn't load the list of resumes." };
    }
    if (!data || data.length === 0) break;
    apps.push(...data);
    if (data.length < PAGE) break;
  }

  const ID_CHUNK = 200;
  const profileById = new Map<string, { first_name: string; last_name: string; hhid: string }>();
  const decisionById = new Map<string, { type: string; released: boolean }>();
  for (let i = 0; i < apps.length; i += ID_CHUNK) {
    const chunk = apps.slice(i, i + ID_CHUNK).map((a) => a.id);
    const [profiles, decisions] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name, hhid").in("id", chunk),
      supabase.from("decisions").select("id, type, released").in("id", chunk),
    ]);
    if (profiles.error || decisions.error) {
      console.error("listResumesForDownload lookup failed", profiles.error ?? decisions.error);
      return { ok: false, error: "Couldn't load names and decisions for the resumes." };
    }
    for (const p of profiles.data || []) profileById.set(p.id, p);
    for (const d of decisions.data || []) decisionById.set(d.id, d);
  }

  const files: ResumeFile[] = [];
  for (const a of apps) {
    const decision = decisionById.get(a.id);
    const accepted = Boolean(decision && decision.released && decision.type === "accepted");
    if (scope !== "all" && !accepted) continue;
    if (scope === "shared" && a.resume_share !== true) continue;
    const profile = profileById.get(a.id);
    files.push({
      id: a.id,
      hhid: profile?.hhid ?? "",
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      email: a.email ?? "",
      school: a.school ?? "",
      major: a.major ?? "",
      graduationYear: a.graduation_year,
      decision: decision ? (decision.released ? decision.type : `${decision.type} (staged)`) : "undecided",
      resumeShare: a.resume_share === true,
    });
  }
  files.sort(
    (x, y) =>
      x.lastName.localeCompare(y.lastName) || x.firstName.localeCompare(y.firstName) || x.id.localeCompare(y.id)
  );

  // Leave a trace of who pulled a bulk list of resumes, and how many.
  console.info(`resume bulk download: admin ${requester.id} listed ${files.length} resumes (scope: ${scope})`);
  return { ok: true, files };
}

// Short-lived download links for a small batch of resumes (admin only).
// A missing file comes back as null rather than failing the batch.
export async function getResumeSignedUrls(
  applicantIds: string[]
): Promise<{ ok: true; urls: Record<string, string | null> } | { ok: false; error: string }> {
  await requireAdmin();

  const ids = Array.isArray(applicantIds)
    ? Array.from(new Set(applicantIds.filter((id) => typeof id === "string" && UUID_RE.test(id))))
    : [];
  if (ids.length === 0) return { ok: false, error: "No resumes requested." };
  if (ids.length > MAX_RESUME_URLS_PER_CALL) {
    return { ok: false, error: `Request at most ${MAX_RESUME_URLS_PER_CALL} resumes at a time.` };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("resumes")
    .createSignedUrls(ids.map((id) => `${id}/resume.pdf`), RESUME_URL_TTL_SECONDS);
  if (error || !data) {
    console.error("getResumeSignedUrls failed", error);
    return { ok: false, error: "Couldn't create download links." };
  }

  const urls: Record<string, string | null> = {};
  for (const id of ids) urls[id] = null;
  for (const item of data) {
    const id = item.path?.split("/")[0];
    if (id && id in urls && !item.error && item.signedUrl) urls[id] = item.signedUrl;
  }
  return { ok: true, urls };
}

// Generates a short-lived signed URL for a resume in the private bucket.
// Only the owner or staff may read a resume.
export async function getResumeUrl(applicantId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (user.id !== applicantId) {
    await requireStaff();
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("resumes")
    .createSignedUrl(`${applicantId}/resume.pdf`, 60 * 10);

  if (error || !data) return null;
  return data.signedUrl;
}
