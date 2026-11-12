import { PortalPageHeading } from "@/components/portal-page-heading";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import { ApplicationForm } from "@/components/forms/application-form";
import { ApplicationSummary } from "@/components/application-summary";

export default async function ApplyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signin");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "applicant") {
    redirect("/dashboard");
  }

  if (!user.email_confirmed_at) {
    return (
      <div className="space-y-6">
        <PortalPageHeading eyebrow="Your next chapter / 2027" title="Build something that matters." description="Your H4SG application starts here." />
        <div className="w-full rounded-md border border-gray-200 bg-white p-4 shadow md:p-6 space-y-2">
          <h2 className="text-xl font-bold">Verify Your Email</h2>
          <p>Please verify your email address before starting your application. Check your inbox for the verification link.</p>
        </div>
      </div>
    );
  }

  const { data: application } = await admin
    .from("applications")
    .select("*")
    .eq("id", user.id)
    .single();

  const opens = process.env.NEXT_PUBLIC_APP_OPENS;
  const closes = process.env.NEXT_PUBLIC_APP_CLOSES;
  const now = new Date();
  const isOpen = opens && closes
    ? now >= new Date(opens) && now <= new Date(closes)
    : false;

  if (!isOpen && !application?.submitted) {
    const opensDate = opens ? new Date(opens) : null;
    const closesDate = closes ? new Date(closes) : null;

    return (
      <div className="space-y-6">
        <PortalPageHeading eyebrow="Your next chapter / 2027" title="Build something that matters." description="Your H4SG application starts here." />
        <div className="w-full rounded-md border border-gray-200 bg-white p-4 shadow md:p-6 space-y-3">
          {opensDate && now < opensDate ? (
            <>
              <h2 className="text-xl font-bold">Applications Not Yet Open</h2>
              <p>Applications open {opensDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })}.</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">Applications Closed</h2>
              <p>The application deadline has passed.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  let resumeUrl: string | null = null;
  if (application?.submitted && application.resume_url) {
    const { data: signed } = await admin.storage
      .from("resumes")
      .createSignedUrl(`${user.id}/resume.pdf`, 60 * 10);
    resumeUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="space-y-6">
      <PortalPageHeading eyebrow="Hack 4 Social Good / March 5–7, 2027"
        title={application?.submitted ? "Your story, submitted." : "Start with your story."}
        description={application?.submitted ? "A copy of your application. We’ll share updates on your dashboard." : "Tell us what you care about, what you want to learn, and what you’d love to build."} />
      {application?.submitted ? (
        <ApplicationSummary application={application} resumeUrl={resumeUrl} />
      ) : (
        <ApplicationForm
          userId={user.id}
          email={user.email || ""}
          defaultName={`${profile.first_name || ""} ${profile.last_name || ""}`.trim()}
          existingApplication={application}
        />
      )}
    </div>
  );
}
