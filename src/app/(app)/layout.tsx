import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { PortalShell } from "@/components/portal-shell";
import { canViewAnnouncements } from "@/lib/announcement-access";
import { generateHackerId } from "@/lib/utils";
import type { Profile } from "@/types/database";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const admin = createAdminClient();

  let { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    const meta = user.user_metadata || {};
    const firstName = meta.first_name || "User";
    const lastName = meta.last_name || "";
    const hhid = generateHackerId();

    const { data: newProfile } = await admin
      .from("profiles")
      .insert({
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        hhid,
        role: "applicant",
      })
      .select()
      .single();

    if (!newProfile) {
      const { data: retry } = await admin
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      profile = retry;
    } else {
      profile = newProfile;
    }

    if (!profile) {
      redirect("/signin");
    }
  }

  // The shared check-in station account only ever gets the scanner.
  if (profile.role === "checkin") redirect("/scan");

  return (
    <PortalShell
      profile={profile as Profile}
      email={user.email || ""}
      verified={Boolean(user.email_confirmed_at)}
      showAnnouncements={await canViewAnnouncements(admin, user.id, profile.role)}
    >
      {children}
    </PortalShell>
  );
}
