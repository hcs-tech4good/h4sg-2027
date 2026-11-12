import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import { HackerDashboard } from "@/components/hacker-dashboard";
import { AdminDashboard } from "@/components/admin-dashboard";
import { checkinQrDataUrl } from "@/lib/checkin-qr";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signin");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <div className="space-y-6">
        <h1 className="mb-8 text-5xl font-bold md:text-6xl">Dashboard</h1>
        <div className="w-full rounded-md border border-gray-200 bg-white p-4 shadow md:p-6">
          <p>Setting up your profile... Please refresh the page.</p>
        </div>
      </div>
    );
  }

  const isStaff = profile.role === "admin" || profile.role === "reviewer";

  if (isStaff) {
    const [
      { count: totalApps },
      { count: submittedApps },
      { count: totalDecisions },
      { count: stagedDecisions },
      { count: releasedDecisions },
      { count: confirmations },
      { count: checkins },
    ] = await Promise.all([
      admin.from("applications").select("*", { count: "exact", head: true }),
      admin.from("applications").select("*", { count: "exact", head: true }).eq("submitted", true),
      admin.from("decisions").select("*", { count: "exact", head: true }),
      admin.from("decisions").select("*", { count: "exact", head: true }).eq("released", false),
      admin.from("decisions").select("*", { count: "exact", head: true }).eq("released", true),
      admin.from("confirmations").select("*", { count: "exact", head: true }),
      admin.from("checkins").select("*", { count: "exact", head: true }).eq("checked_in", true),
    ]);

    return (
      <AdminDashboard
        stats={{
          totalApps: totalApps || 0,
          submittedApps: submittedApps || 0,
          totalDecisions: totalDecisions || 0,
          stagedDecisions: stagedDecisions || 0,
          releasedDecisions: releasedDecisions || 0,
          confirmations: confirmations || 0,
          checkins: checkins || 0,
        }}
      />
    );
  }

  const { data: application } = await admin
    .from("applications")
    .select("submitted, submitted_at, h4sg_details")
    .eq("id", user.id)
    .single();

  const { data: decision } = await admin
    .from("decisions")
    .select("type, released")
    .eq("id", user.id)
    .single();

  const { data: confirmation } = await admin
    .from("confirmations")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: matchingCodeRow } = await admin
    .from("matching_codes")
    .select("code")
    .eq("id", user.id)
    .maybeSingle();

  // Check-in QR for accepted hackers who have completed the registration form.
  // ensure_checkin_token returns their token, creating one if they have none.
  // Hackers who haven't registered are never sent the code.
  let checkin: { qr: string } | null = null;
  if (decision?.released && decision.type === "accepted" && confirmation) {
    const ensured = await admin.rpc("ensure_checkin_token", { p_user_id: user.id });
    let token: unknown = ensured.data;
    if (ensured.error) {
      console.error("ensure_checkin_token failed", ensured.error);
      // Still show an existing token if the function is unavailable.
      const { data: row } = await admin
        .from("checkin_tokens")
        .select("token")
        .eq("id", user.id)
        .maybeSingle();
      token = row?.token;
    }
    if (typeof token === "string" && token) {
      try {
        checkin = { qr: await checkinQrDataUrl(token) };
      } catch (e) {
        // Never take the whole dashboard down over the QR card.
        console.error("check-in QR render failed", e);
      }
    }
  }

  // Claude API credits for accepted hackers who have checked in. The first
  // call claims a code from the pool; later calls return the same one.
  let creditCode: { code: string; link: string } | null = null;
  if (decision?.released && decision.type === "accepted") {
    const { data, error } = await admin.rpc("claim_credit_code", { p_user_id: user.id });
    const row = (data as { code: string; signup_link: string }[] | null)?.[0];
    if (error) console.error("claim_credit_code failed", error);
    else if (row) creditCode = { code: row.code, link: row.signup_link };
  }

  // Where the hacker's team is judged. Assignments are stored by team member
  // email, so match the login email first, then the application email.
  const { data: appEmailRow } = await admin.from("applications").select("email").eq("id", user.id).maybeSingle();
  const myEmails = [...new Set([user.email, appEmailRow?.email].filter(Boolean).map((e) => e!.trim().toLowerCase()))];
  let judging: {
    project_name: string;
    table_location: string;
    track: string | null;
    time_slot: string | null;
    judges: string[];
  } | null = null;
  if (myEmails.length > 0) {
    const { data, error } = await admin
      .from("judging_assignments")
      .select("email, project_name, table_location, track, time_slot, judges")
      .in("email", myEmails);
    if (error) console.error("judging_assignments lookup failed", error);
    const row = data?.sort((a, b) => myEmails.indexOf(a.email) - myEmails.indexOf(b.email))[0];
    if (row) {
      judging = {
        project_name: row.project_name,
        table_location: row.table_location,
        track: row.track,
        time_slot: row.time_slot,
        judges: row.judges ?? [],
      };
    }
  }

  return (
    <HackerDashboard
      profile={profile}
      email={user.email ?? ""}
      application={application}
      decision={decision?.released ? decision : null}
      confirmation={confirmation}
      matchingCode={matchingCodeRow?.code ?? null}
      checkin={checkin}
      creditCode={creditCode}
      judging={judging}
    />
  );
}
