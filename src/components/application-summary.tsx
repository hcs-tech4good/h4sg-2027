import { H4sgApplicationSummary } from "@/components/h4sg-application-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Application } from "@/types/database";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="sm:col-span-2 text-sm whitespace-pre-wrap">{value || "—"}</span>
    </div>
  );
}

function yn(v: boolean | null) {
  return v ? "Yes" : "No";
}

interface ApplicationSummaryProps {
  application: Application;
  resumeUrl?: string | null;
}

// Read-only display of a submitted application (applicant-facing).
export function ApplicationSummary({ application, resumeUrl }: ApplicationSummaryProps) {
  return (
    <div className="space-y-6">
      <div className="w-full rounded-md bg-green-100 p-4 text-sm md:p-6">
        <p className="font-bold text-green-900">Application submitted!</p>
        <p className="mt-1">
          Submitted on{" "}
          {application.submitted_at
            ? new Date(application.submitted_at).toLocaleString()
            : "—"}
          . Your application is now locked and can no longer be edited. Check your
          dashboard for status updates.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Personal</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Field label="Email" value={application.email} />
          <Field label="Age" value={application.age} />
          <Field label="Gender" value={application.gender} />
          <Field label="Race/Ethnicity" value={application.race?.join(", ")} />
          <Field label="Underrepresented" value={application.underrepresented} />
          <Field label="Phone" value={application.phone} />
          <Field label="Country of Residence" value={application.country} />
          <Field
            label="Shipping Address"
            value={[
              application.address_line1,
              application.address_line2,
              application.city,
              application.state,
              application.zip,
              application.address_country,
            ]
              .filter(Boolean)
              .join(", ")}
          />
          <Field label="Dietary Restrictions" value={application.dietary_restrictions?.join(", ")} />
          <Field label="Other Allergies/Dietary" value={application.dietary_other} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Academic</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Field label="Education Level" value={application.level_of_study} />
          <Field label="Pursuing Undergrad" value={yn(application.enrolled)} />
          <Field label="School" value={application.school} />
          <Field label="Graduation Year" value={application.graduation_year} />
          <Field label="Major" value={application.major} />
          <Field label="Harvard Affiliated" value={yn(application.harvard_affiliated)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Hackathon</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Field label="Shirt Size" value={application.shirt_size} />
          <Field label="First Hackathon" value={yn(application.first_hackathon)} />
          <Field label="Previous Hack 4 Social Good" value={yn(application.previously_participated)} />
          <Field label="Able to Attend" value={yn(application.able_to_attend)} />
          <Field label="How They Heard" value={application.referral_source} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Open Response</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Field
            label="Team Roles"
            value={[application.team_roles?.join(", "), application.other_role].filter(Boolean).join(" — ")}
          />
          <Field
            label="Programming Languages"
            value={[application.programming_languages?.join(", "), application.other_language].filter(Boolean).join(" — ")}
          />
          <Field label="Experience" value={application.experience} />
          <Field label="Goals & Aspirations" value={application.essay_why_hh} />
          <Field label="Impactful Project" value={application.essay_project} />
          <Field label="Unlimited Resources" value={application.essay_unlimited_resource} />
          <Field label="Space Question" value={application.essay_space} />
          <Field label="Requesting Financial Accommodations" value={yn(application.financial_aid)} />
          {application.financial_aid && (
            <Field label="Financial Situation" value={application.financial_aid_detail} />
          )}
          <Field
            label="Resume"
            value={
              resumeUrl ? (
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:underline"
                >
                  {application.resume_name || "View Resume"}
                </a>
              ) : application.resume_url ? (
                "Uploaded"
              ) : null
            }
          />
          <Field label="Share Resume with Sponsors" value={yn(application.resume_share)} />
        </CardContent>
      </Card>

      <H4sgApplicationSummary details={application.h4sg_details} />

      <Card>
        <CardHeader><CardTitle>Agreements</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Field label="Code of Conduct" value={application.code_of_conduct ? "Agreed" : "No"} />
          <Field label="MLH Marketing Emails" value={application.mlh_emails ? "Opted in" : "No"} />
        </CardContent>
      </Card>
    </div>
  );
}
