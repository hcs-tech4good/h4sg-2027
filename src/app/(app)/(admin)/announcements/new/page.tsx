import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { emailConfigured } from "@/lib/email";
import { AnnouncementComposer } from "@/components/announcement-composer";

export default async function NewAnnouncementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, first_name")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") redirect("/announcements");

  const { count } = await admin
    .from("decisions")
    .select("*", { count: "exact", head: true })
    .eq("released", true)
    .eq("type", "accepted");

  return (
    <AnnouncementComposer
      recipientCount={count ?? 0}
      emailConfigured={emailConfigured()}
      previewName={profile.first_name || "there"}
    />
  );
}
