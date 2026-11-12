"use client";

import Link from "next/link";
import { MarineIcon, type MarineKind } from "@/components/marine-art";
import { ArrowUpRight, CalendarDays, MapPin, LifeBuoy, Check, Waves } from "lucide-react";
import { PortalPageHeading } from "@/components/portal-page-heading";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ATTENDANCE_OPTIONS } from "@/data";
import { RegistrationForm } from "@/components/registration-form";
import type { H4sgDetails } from "@/lib/h4sg-application";
import type { Profile } from "@/types/database";

interface HackerDashboardProps {
  profile: Profile;
  email: string;
  application: { submitted: boolean; submitted_at: string | null; h4sg_details?: H4sgDetails } | null;
  decision: { type: string; released: boolean } | null;
  confirmation: { confirmed: string } | null;
  matchingCode: string | null;
  checkin: { qr: string } | null;
  creditCode: { code: string; link: string } | null;
  judging: {
    project_name: string;
    table_location: string;
    track: string | null;
    judges: string[];
    time_slot: string | null;
  } | null;
}

export function HackerDashboard({
  profile,
  email,
  application,
  decision,
  confirmation: initialConfirmation,
  matchingCode,
  checkin,
  creditCode,
  judging,
}: HackerDashboardProps) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState(initialConfirmation);

  function getStatusText() {
    if (decision?.type === "accepted") return "Accepted";
    if (!application) return "Not Started";
    if (!application.submitted) return "In Progress";
    if (!decision) return "Submitted";
    if (decision.type === "waitlisted") return "Waitlisted";
    return "Not Accepted";
  }

  function getStatusColor() {
    if (!decision) return "bg-teal-50 text-teal-800";
    if (decision.type === "accepted") return "bg-green-100";
    if (decision.type === "waitlisted") return "bg-yellow-100";
    return "bg-red-100";
  }

  return (
    <div className="space-y-7">
      <PortalPageHeading eyebrow="Hack 4 Social Good / 2027" title={`Hi, ${profile.first_name || "hacker"}.`} description="Your application, your next steps, and a weekend of possibilities." />
      <div className="portal-event-strip"><span><CalendarDays size={16} />March 5–7, 2027</span><span><MapPin size={16} />Cambridge, MA</span><a href="/">About the event <ArrowUpRight size={14} /></a></div>
      <div className="portal-dashboard-grid"><div className="portal-dashboard-primary space-y-6">
      {/* Status Card */}
      <div className="portal-panel application-status-panel space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="marine-card-title"><MarineIcon kind="shell" />Application status</h2>
          <span className={`rounded-md px-3 py-1 text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        <ol className="portal-journey" aria-label="Application journey">
          {[{ label: "Apply", detail: "Tell us your story", done: Boolean(application?.submitted), current: !application?.submitted }, { label: "Review", detail: "We review applications", done: Boolean(decision), current: Boolean(application?.submitted && !decision) }, { label: "Decision", detail: "Find your next step", done: Boolean(confirmation), current: Boolean(decision && !confirmation) }].map((step, index) => <li key={step.label} className={step.done ? "is-done" : step.current ? "is-current" : ""}><span className="portal-step-circle">{step.done ? <Check size={15} /> : <MarineIcon kind={(["fish", "jellyfish", "starfish"] as MarineKind[])[index]} />}</span><span><strong>{step.label}</strong><small>{step.detail}</small></span></li>)}
        </ol>
        {!application && !decision && (
          <div className="space-y-3">
            <p>You haven&apos;t started your application yet. Get started now!</p>
            <Link href="/apply" className="portal-cta">
              Start application <ArrowUpRight size={16} />
            </Link>
          </div>
        )}

        {application && !application.submitted && !decision && (
          <div className="space-y-3">
            <p>Your application is in progress. Make sure to submit before the deadline.</p>
            <Link href="/apply" className="portal-cta">
              Continue application <ArrowUpRight size={16} />
            </Link>
          </div>
        )}

        {application?.submitted && !decision && (
          <p>Your application is submitted and in review! We&apos;ll update your status here when decisions are released.</p>
        )}

        {decision?.type === "accepted" && confirmation && confirmation.confirmed === ATTENDANCE_OPTIONS[0] && (
          <p className="font-bold text-green-900">You&apos;re confirmed! See you at Hack 4 Social Good 2027.</p>
        )}

        {decision?.type === "accepted" && confirmation && confirmation.confirmed !== ATTENDANCE_OPTIONS[0] && (
          <p>We&apos;ve recorded that you can&apos;t attend Hack 4 Social Good 2027. Thanks for letting us know.</p>
        )}

        {decision?.type === "accepted" && !confirmation && (
          <div className="space-y-1">
            <p className="font-bold text-green-900">
              Congratulations, you&apos;ve been accepted! Complete your registration below to confirm your spot.
            </p>
            <p className="text-sm text-gray-600">
              If you applied for travel reimbursement, we&apos;ll reach out to you individually about it.
            </p>
          </div>
        )}

        {decision?.type === "waitlisted" && (
          <p>You&apos;ve been waitlisted. We will follow up if a spot opens up.</p>
        )}

        {decision?.type === "rejected" && (
          <div className="space-y-2">
            <p>Unfortunately, we were unable to offer you a spot this year. Thank you for applying.</p>
            <p className="text-sm text-gray-500">
              If you applied during the early application cycle and most of your intended
              team was accepted, you may appeal by emailing{" "}
              <a href="mailto:operations@t4sg.dev" className="text-teal-600 hover:underline">
                operations@t4sg.dev
              </a>
              .
            </p>
          </div>
        )}

        {application?.submitted && (
          <Link
            href="/apply"
            className="inline-block border-b border-black text-sm text-black transition-colors hover:border-gray-600 hover:text-gray-600"
          >
            View application
          </Link>
        )}
      </div>

      {/* Judging — hackers whose team is in the judging plan */}
      {judging && (
        <div className="portal-panel w-full rounded-md border-2 border-sky-300 bg-sky-50 p-4 shadow md:p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-sky-950">Your Judging</h2>
            <p className="mt-1 text-sm text-sky-900">
              Set up your project at your table so judges can find you.
            </p>
          </div>

          <div className="flex flex-wrap items-stretch gap-3">
            <div className="rounded-md border border-sky-300 bg-white px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-sky-700">Table</div>
              <div className="text-3xl font-bold text-sky-950">
                {judging.table_location.replace(/^table\s*/i, "") || judging.table_location}
              </div>
            </div>
            <div className="min-w-0 flex-1 rounded-md border border-sky-300 bg-white px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-sky-700">Project</div>
              <div className="break-words text-lg font-bold text-sky-950">{judging.project_name}</div>
              {judging.track && <div className="mt-0.5 text-sm text-sky-800">{judging.track}</div>}
            </div>
          </div>

          {judging.time_slot && (
            <p className="text-base font-semibold text-sky-950">This is your table for {judging.time_slot}.</p>
          )}

          <div className="text-sm text-sky-950">
            <span className="font-semibold">Judges:</span>{" "}
            {judging.judges.length > 0
              ? judging.judges.join(", ")
              : "Your judges haven't been assigned yet. They'll show up here."}
          </div>
        </div>
      )}

      {/* Claude API credits — accepted hackers who have checked in */}
      {decision?.type === "accepted" && creditCode && (
        <div className="portal-panel w-full rounded-md border-2 border-orange-300 bg-orange-50 p-4 shadow md:p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-orange-950">Your Claude API Credits</h2>
            <p className="mt-1 text-sm text-orange-950">
              Thanks for checking in! Here are free Claude API credits to build with this weekend.
            </p>
          </div>

          <div className="inline-flex max-w-full flex-wrap items-center gap-3 rounded-md border border-orange-300 bg-white px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wide text-orange-700">Your Code</span>
            <span className="break-all font-mono text-sm font-bold text-orange-950">{creditCode.code}</span>
          </div>

          <div>
            <a
              href={creditCode.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md bg-orange-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors duration-300 hover:bg-orange-700"
            >
              Redeem on Claude Platform &rarr;
            </a>
          </div>

          <p className="text-xs text-orange-800">
            This code is unique to you and can only be used once, so please don&apos;t share it.
          </p>
        </div>
      )}

      {/* Check-in */}
      {decision?.type === "accepted" && checkin && (
        <div className="portal-panel w-full rounded-md border-2 border-green-300 bg-white p-4 shadow md:p-6 space-y-3">
          <h2 className="text-2xl font-bold">Your Check-in QR Code</h2>
          <p className="text-sm text-gray-600">Show this QR code to the staff at the front when you arrive.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL, nothing to optimise */}
          <img
            src={checkin.qr}
            alt="Your Hack 4 Social Good check-in QR code"
            width={240}
            height={240}
            className="mx-auto block h-60 w-60 max-w-full rounded-md bg-white"
          />
          <p className="text-center text-xs text-gray-500">
            Tip: turn your screen brightness up so it scans quickly. If it won&apos;t scan, give staff your
            Hacker ID (<span className="font-mono">{profile.hhid}</span>) and last name.
          </p>
        </div>
      )}
      {decision?.type === "accepted" && !confirmation && (
        <div className="portal-panel w-full rounded-md border-2 border-amber-300 bg-amber-50 p-4 shadow md:p-6 space-y-2">
          <h2 className="text-xl font-bold text-amber-900">Your Check-in QR Code</h2>
          <p className="text-sm text-amber-900">
            You can&apos;t see your check-in QR code until you complete the registration form below. You&apos;ll
            need it to get into Hack 4 Social Good.
          </p>
        </div>
      )}

      {/* Registration / Confirmation Form */}
      {decision?.type === "accepted" && !confirmation && (
        <div className="portal-panel w-full rounded-md border border-gray-200 bg-white p-4 shadow md:p-6 space-y-4">
          <h2 className="text-xl font-bold">Register for Hack 4 Social Good 2027</h2>
          <RegistrationForm
            defaultName={`${profile.first_name} ${profile.last_name}`.trim()}
            defaultEmail={email}
            defaultPhotoConsent={application?.h4sg_details?.photo_consent === "I consent"}
            onSubmitted={(confirmed) => {
              setConfirmation({ confirmed });
              router.refresh();
            }}
          />
        </div>
      )}

      {/* Hacker matching platform — accepted applicants with a code */}
      {decision?.type === "accepted" && matchingCode && (
        <div className="portal-panel w-full rounded-md border-2 border-indigo-300 bg-indigo-50 p-4 shadow md:p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-indigo-900">Find a Team: Hacker Matching</h2>
            <p className="mt-1 text-sm text-indigo-900">
              Hack 4 Social Good 2027 has an official hacker matching platform to help you find teammates.
              Use your code below to get in.
            </p>
          </div>

          <div className="inline-flex items-center gap-3 rounded-md border border-indigo-300 bg-white px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wide text-indigo-500">Your Code</span>
            <span className="font-mono text-xl font-bold tracking-wider text-indigo-900">{matchingCode}</span>
          </div>

          <div>
            <a
              href="https://matching.hhuh.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors duration-300 hover:bg-indigo-700"
            >
              Find teammates &rarr;
            </a>
          </div>

          <p className="text-xs text-indigo-700">
            This code is unique to you — please don&apos;t share it with anyone else.
          </p>
        </div>
      )}

      {decision?.type === "accepted" && !matchingCode && (
        <div className="portal-panel w-full rounded-md border border-gray-200 bg-gray-50 p-4 shadow md:p-6 space-y-2">
          <h2 className="text-xl font-bold">Hacker Matching</h2>
          <p className="text-sm text-gray-700">
            You don&apos;t have access to the hacker matching platform for now. If that changes, it will show up here.
          </p>
        </div>
      )}

      </div>
      <aside className="portal-dashboard-aside space-y-5" aria-label="Event resources">
        <section className="portal-hacker-pass"><div className="portal-pass-top"><span>Hacker ID</span><MarineIcon kind="shell" /></div><p className="portal-pass-id">{profile.hhid}</p><p>Keep this ID handy for check-in.</p><div className="portal-pass-bottom"><span>{profile.first_name} {profile.last_name}</span><span>H4SG</span></div></section>
        <section className="portal-panel"><p className="portal-eyebrow">The essentials</p><h2 className="marine-card-title mt-2"><MarineIcon kind="turtle" />See you in Cambridge.</h2><dl className="portal-event-details"><div><dt><CalendarDays size={17} />When</dt><dd>March 5–7, 2027</dd></div><div><dt><MapPin size={17} />Where</dt><dd>Cambridge, Massachusetts</dd></div><div><dt><Waves size={17} />Who</dt><dd>Undergraduate builders of every experience level</dd></div></dl><a href="/" className="portal-text-link">Explore the event <ArrowUpRight size={15} /></a></section>
        <section className="portal-help-card"><LifeBuoy size={23} /><h2>Need a hand?</h2><p>Questions about your application or getting ready for the weekend?</p><Link href="/faq" className="portal-text-link">Visit the help center <ArrowUpRight size={15} /></Link><a href="mailto:operations@t4sg.dev" className="portal-contact-link">operations@t4sg.dev</a></section>
      </aside>
      </div>
    </div>
  );
}
