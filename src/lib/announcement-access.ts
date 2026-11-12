import type { createAdminClient } from "@/lib/supabase-admin";

// Announcements are for staff and for applicants whose decision is released
// and accepted. Mirrors the database policy in migration 014.
export async function canViewAnnouncements(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  role: string | null | undefined
) {
  if (role === "admin" || role === "reviewer") return true;
  const { data: decision } = await admin
    .from("decisions")
    .select("type, released")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(decision && decision.released && decision.type === "accepted");
}
