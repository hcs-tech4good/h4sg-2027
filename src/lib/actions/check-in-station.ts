"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import {
  CHECKIN_TOKEN_RE,
  normalizeHackerId,
  type RegistrationStatus,
  type StationResult,
  type StationStats,
} from "@/lib/check-in";

const STATION_ROLES = new Set(["checkin", "admin", "reviewer"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LAST_NAME = 100;

// The check-in station account, plus staff (so admins can run a station too).
async function requireStation() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !STATION_ROLES.has(profile.role)) {
    throw new Error("Unauthorized: check-in access required");
  }
  return user;
}

type Row = {
  status: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  hhid: string | null;
  shirt_size: string | null;
  registration: string | null;
  decision: string | null;
  checked_in_at: string | null;
};

function toResult(row: Row | undefined): StationResult {
  if (!row || row.status === "unknown" || !row.user_id) return { status: "unknown" };
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Unknown name";
  const hhid = row.hhid ?? "";
  if (row.status === "not_accepted") {
    return { status: "not_accepted", name, hhid, decision: row.decision ?? "none" };
  }
  if ((row.status === "checked_in" || row.status === "already_checked_in") && row.checked_in_at) {
    return {
      status: row.status,
      userId: row.user_id,
      name,
      hhid,
      shirtSize: row.shirt_size,
      registration: (row.registration as RegistrationStatus) ?? "not_registered",
      checkedInAt: row.checked_in_at,
    };
  }
  return { status: "invalid", message: "Unexpected response. Please try again." };
}

// Checks a hacker in from a scanned QR token, or from their Hacker ID plus last
// name (the manual fallback). Requiring the last name with the Hacker ID means the
// station can't be used to look people up by guessing Hacker IDs.
export async function stationCheckIn(
  input: { token: string } | { hhid: string; lastName: string }
): Promise<StationResult> {
  const user = await requireStation();

  let args: { p_token: string | null; p_hhid: string | null; p_last_name: string | null };
  if (input && typeof (input as { token?: unknown }).token === "string") {
    const token = (input as { token: string }).token.trim().toUpperCase();
    if (!CHECKIN_TOKEN_RE.test(token)) return { status: "not_our_code" };
    args = { p_token: token, p_hhid: null, p_last_name: null };
  } else {
    const raw = input as { hhid?: unknown; lastName?: unknown };
    const hhid = typeof raw?.hhid === "string" ? normalizeHackerId(raw.hhid) : null;
    const lastName = typeof raw?.lastName === "string" ? raw.lastName.trim() : "";
    if (!hhid) return { status: "invalid", message: "Enter a Hacker ID like H-1234567." };
    if (!lastName || lastName.length > MAX_LAST_NAME) {
      return { status: "invalid", message: "Enter the hacker's last name." };
    }
    args = { p_token: null, p_hhid: hhid, p_last_name: lastName };
  }

  const { data, error } = await createAdminClient().rpc("station_check_in", { ...args, p_by: user.id });
  if (error) {
    console.error("station_check_in failed", error);
    return { status: "invalid", message: "Check-in failed. Please try again." };
  }
  return toResult((data as Row[] | null)?.[0]);
}

// Reverses a check-in made in the last 15 minutes (a mistaken scan).
export async function stationUndoCheckIn(userId: string): Promise<{ ok: boolean }> {
  const user = await requireStation();
  if (typeof userId !== "string" || !UUID_RE.test(userId)) return { ok: false };

  const { data, error } = await createAdminClient().rpc("station_undo_check_in", {
    p_user_id: userId,
    p_by: user.id,
  });
  if (error) {
    console.error("station_undo_check_in failed", error);
    return { ok: false };
  }
  return { ok: data === true };
}

export async function stationStats(): Promise<StationStats> {
  await requireStation();
  const admin = createAdminClient();
  const [checkedIn, accepted] = await Promise.all([
    admin.from("checkins").select("id", { count: "exact", head: true }).eq("checked_in", true),
    admin
      .from("decisions")
      .select("id", { count: "exact", head: true })
      .eq("released", true)
      .eq("type", "accepted"),
  ]);
  return { checkedIn: checkedIn.count ?? 0, accepted: accepted.count ?? 0 };
}
