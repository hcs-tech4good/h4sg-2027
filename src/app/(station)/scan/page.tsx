import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { stationCheckIn, stationStats, stationUndoCheckIn } from "@/lib/actions/check-in-station";
import { CheckInStation } from "@/components/check-in/check-in-station";

export const metadata: Metadata = { title: "Check-in | Hack 4 Social Good" };

const STATION_ROLES = new Set(["checkin", "admin", "reviewer"]);

export default async function ScanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !STATION_ROLES.has(profile.role)) redirect("/dashboard");

  return (
    <CheckInStation
      initialStats={await stationStats()}
      isStationAccount={profile.role === "checkin"}
      actions={{ checkIn: stationCheckIn, undo: stationUndoCheckIn, stats: stationStats }}
    />
  );
}
