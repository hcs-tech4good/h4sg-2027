import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import { ApplicationDetail } from "@/components/application-detail";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "reviewer")) {
    redirect("/dashboard");
  }

  const { data: application } = await admin
    .from("applications")
    .select("*")
    .eq("id", id)
    .single();

  if (!application) {
    redirect("/applications");
  }

  const { data: applicantProfile } = await admin
    .from("profiles")
    .select("first_name, last_name, hhid")
    .eq("id", id)
    .single();

  const { data: decision } = await admin
    .from("decisions")
    .select("*")
    .eq("id", id)
    .single();

  let resumeUrl: string | null = null;
  if (application.resume_url) {
    const { data: signed } = await admin.storage
      .from("resumes")
      .createSignedUrl(`${id}/resume.pdf`, 60 * 10);
    resumeUrl = signed?.signedUrl ?? null;
  }

  return (
    <ApplicationDetail
      application={application}
      profile={applicantProfile}
      decision={decision}
      resumeUrl={resumeUrl}
    />
  );
}
