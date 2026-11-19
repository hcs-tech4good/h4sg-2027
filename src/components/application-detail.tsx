"use client";

import { H4sgApplicationSummary } from "@/components/h4sg-application-summary";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { changeReleasedDecision, makeDecision } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Application, Decision } from "@/types/database";

interface ApplicationDetailProps {
  application: Application;
  profile: { first_name: string; last_name: string; hhid: string } | null;
  decision: Decision | null;
  resumeUrl?: string | null;
}

export function ApplicationDetail({
  application,
  profile,
  decision: initialDecision,
  resumeUrl,
}: ApplicationDetailProps) {
  const router = useRouter();
  const [decision, setDecision] = useState(initialDecision);
  const [loading, setLoading] = useState(false);

  async function handleReleasedChange(type: "accepted" | "waitlisted" | "rejected") {
    if (!decision || decision.type === type) return;
    const name = profile ? `${profile.first_name} ${profile.last_name}` : "This applicant";
    const ok = confirm(
      `Change ${name} from ${decision.type} to ${type}?\n\n` +
        "Their result is already released, so they will see the change right away and be emailed an update."
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await changeReleasedDecision(application.id, type);
      if (!res.ok) {
        alert(res.error);
      } else if (!res.changed) {
        setDecision({ ...decision, type });
        alert(`This applicant is already ${type}. Nothing was changed and no email was sent.`);
        router.refresh();
      } else {
        setDecision({ ...decision, type, notified_at: null, notify_error: null });
        if (res.emailError) {
          alert(
            `Changed to ${type}, but the email didn't send: ${res.emailError}\n\n` +
              'It will stay pending. Use "Send pending emails" on the Decisions page once email is fixed.'
          );
        } else if (res.emailed > 0) {
          alert(`Changed to ${type} and emailed the update.`);
        } else {
          alert(
            `Changed to ${type}, but the update email wasn't confirmed as sent. Check the Decisions page for pending or failed emails.`
          );
        }
        router.refresh();
      }
    } catch {
      alert("Failed to change decision. Please try again.");
    }
    setLoading(false);
  }

  async function handleDecision(type: "accepted" | "waitlisted" | "rejected") {
    if (decision?.released) return handleReleasedChange(type);
    setLoading(true);

    try {
      const res = await makeDecision(application.id, type);
      if (!res.success) {
        alert(res.error);
        setLoading(false);
        return;
      }
      setDecision({
        id: application.id,
        type,
        released: false,
        decided_by: null,
        decided_at: new Date().toISOString(),
        released_at: null,
        notified_at: null,
        notify_error: null,
      });
    } catch {
      alert("Failed to save decision. Please try again.");
    }
    setLoading(false);
  }

  function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="grid grid-cols-3 gap-2 py-2">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="col-span-2 text-sm">{value || "—"}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/applications" className="text-sm text-teal-600 hover:underline">
            &larr; Back to Applications
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {profile?.first_name} {profile?.last_name}
          </h1>
          <p className="text-sm text-gray-500 font-mono">{profile?.hhid}</p>
        </div>
        <div className="flex items-center gap-2">
          {decision && (
            <Badge
              className={
                decision.type === "accepted"
                  ? "bg-green-100 text-green-800"
                  : decision.type === "waitlisted"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }
            >
              {decision.type}
              {!decision.released && " (staged)"}
            </Badge>
          )}
        </div>
      </div>

      {/* Decision Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-green-700 border-green-200 hover:bg-green-50"
          onClick={() => handleDecision("accepted")}
          disabled={loading || (decision?.released && decision.type === "accepted")}
        >
          Accept
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-yellow-700 border-yellow-200 hover:bg-yellow-50"
          onClick={() => handleDecision("waitlisted")}
          disabled={loading || (decision?.released && decision.type === "waitlisted")}
        >
          Waitlist
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-red-700 border-red-200 hover:bg-red-50"
          onClick={() => handleDecision("rejected")}
          disabled={loading || (decision?.released && decision.type === "rejected")}
        >
          Reject
        </Button>
      </div>

      {/* Personal */}
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

      {/* Academic */}
      <Card>
        <CardHeader><CardTitle>Academic</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Field label="Enrolled" value={application.enrolled ? "Yes" : "No"} />
          <Field label="School" value={application.school} />
          <Field label="Graduation Year" value={application.graduation_year} />
          <Field label="Major" value={application.major} />
          <Field label="Level of Study" value={application.level_of_study} />
          <Field label="Harvard Affiliated" value={application.harvard_affiliated ? "Yes" : "No"} />
        </CardContent>
      </Card>

      {/* Hackathon */}
      <Card>
        <CardHeader><CardTitle>Hackathon</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Field label="Shirt Size" value={application.shirt_size} />
          <Field label="First Hackathon" value={application.first_hackathon ? "Yes" : "No"} />
          <Field label="Previous Hack 4 Social Good" value={application.previously_participated ? "Yes" : "No"} />
          <Field label="Able to Attend" value={application.able_to_attend ? "Yes" : "No"} />
          <Field label="Referral Source" value={application.referral_source} />
        </CardContent>
      </Card>

      {/* Open Response */}
      <Card>
        <CardHeader><CardTitle>Open Response</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Field
            label="Team Roles"
            value={[application.team_roles?.join(", "), application.other_role]
              .filter(Boolean)
              .join(" — ")}
          />
          <Field
            label="Programming Languages"
            value={[application.programming_languages?.join(", "), application.other_language]
              .filter(Boolean)
              .join(" — ")}
          />
          <Field label="Experience" value={application.experience} />
          <Field label="Goals & Aspirations" value={application.essay_why_hh} />
          <Field label="Impactful Project" value={application.essay_project} />
          <Field label="Unlimited Resources" value={application.essay_unlimited_resource} />
          <Field label="Space Question" value={application.essay_space} />
          <Field label="Requesting Financial Accommodations" value={application.financial_aid ? "Yes" : "No"} />
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
          <Field label="Share resume with sponsors" value={application.resume_share ? "Yes" : "No"} />
        </CardContent>
      </Card>

      <H4sgApplicationSummary details={application.h4sg_details} />

      {/* Agreements */}
      <Card>
        <CardHeader><CardTitle>Agreements</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Field label="Code of Conduct" value={application.code_of_conduct ? "Agreed" : "No"} />
          <Field label="MLH Marketing Emails" value={application.mlh_emails ? "Opted in" : "No"} />
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-gray-400">
        Submitted: {application.submitted_at ? new Date(application.submitted_at).toLocaleString() : "Not submitted"}
      </p>
    </div>
  );
}
