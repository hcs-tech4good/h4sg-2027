"use client";

import { useState } from "react";
import { submitRegistration } from "@/lib/actions/auth";
import { ATTENDANCE_OPTIONS, STARTUP_STAGE_OPTIONS } from "@/data";

interface RegistrationFormProps {
  defaultName: string;
  defaultEmail: string;
  defaultPhotoConsent?: boolean;
  onSubmitted: (confirmed: string) => void;
}

const inputClass =
  "mt-1 block h-12 w-full rounded-md border border-gray-400 px-3 transition-colors focus:border-gray-600 focus:outline-none";
const selectClass = `${inputClass} appearance-none`;
const checkboxClass =
  "mt-0.5 h-5 w-5 shrink-0 appearance-none rounded-md border border-gray-400 checked:border-gray-600 checked:bg-gray-600 focus:border-gray-600 focus:outline-none";

export function RegistrationForm({ defaultName, defaultEmail, defaultPhotoConsent = false, onSubmitted }: RegistrationFormProps) {
  const [confirmed, setConfirmed] = useState("");
  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [buildingStartup, setBuildingStartup] = useState<boolean | null>(null);
  const [startupStage, setStartupStage] = useState("");
  const [waiver, setWaiver] = useState(false);
  const [photoRelease, setPhotoRelease] = useState(defaultPhotoConsent);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const attending = confirmed === ATTENDANCE_OPTIONS[0];

  function chooseStartup(value: boolean) {
    setBuildingStartup(value);
    if (!value) setStartupStage("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!confirmed) return setError("Please select your attendance status.");
    if (attending) {
      if (!fullName.trim()) return setError("Please enter your full name.");
      if (!email.trim()) return setError("Please enter your email.");
      if (!waiver) return setError("You must agree to the liability waiver.");
    }

    setSubmitting(true);
    try {
      const res = await submitRegistration({
        confirmed,
        fullName,
        email,
        buildingStartup: attending ? buildingStartup : null,
        startupStage: attending && buildingStartup && startupStage ? startupStage : null,
        waiver: attending && waiver,
        photoRelease: attending && photoRelease,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSubmitted(confirmed);
    } catch {
      setError("Failed to submit registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="rounded-md bg-red-200 p-3 text-sm">{error}</div>}

      <div className="space-y-1">
        <label htmlFor="reg-attendance" className="text-sm font-medium">
          Can you attend all 3 days of Hack 4 Social Good? *
        </label>
        <select
          id="reg-attendance"
          value={confirmed}
          onChange={(e) => setConfirmed(e.target.value)}
          className={selectClass}
        >
          <option value="">Select...</option>
          {ATTENDANCE_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {confirmed && !attending && (
        <p className="text-sm text-gray-600">
          Thanks for letting us know. Submit below so we have your response on record.
        </p>
      )}

      {attending && (
        <>
          <div className="space-y-1">
            <label htmlFor="reg-name" className="text-sm font-medium">
              Full name *
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              maxLength={200}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="reg-email" className="text-sm font-medium">
              Email *
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Are you building a startup? (Optional)</legend>
            <div className="flex gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="building-startup"
                  checked={buildingStartup === true}
                  onChange={() => chooseStartup(true)}
                />
                Yes
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="building-startup"
                  checked={buildingStartup === false}
                  onChange={() => chooseStartup(false)}
                />
                No
              </label>
            </div>
          </fieldset>

          {buildingStartup === true && (
            <div className="space-y-1">
              <label htmlFor="reg-stage" className="text-sm font-medium">
                Which best describes your current stage? (Optional)
              </label>
              <select
                id="reg-stage"
                value={startupStage}
                onChange={(e) => setStartupStage(e.target.value)}
                className={selectClass}
              >
                <option value="">Select...</option>
                {STARTUP_STAGE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <p className="font-medium">Liability Waiver</p>
            <p>
              In consideration of being permitted to participate in Hack 4 Social Good 2027, I release and
              hold harmless Hack 4 Social Good, its organizers, sponsors, partners, and the venue and its
              staff, from any and all claims, liabilities, and causes of action arising from my
              participation in the event, including claims of negligence, except to the extent
              caused by gross negligence or willful misconduct. I understand that participation
              involves activities over multiple days, including working long or overnight hours,
              and that I am responsible for my own health, safety, and belongings throughout the
              event. I certify that I am physically able to participate and am not aware of any
              medical condition that would put me at risk by attending. I agree to follow the
              Hack 4 Social Good code of conduct and all venue rules, and understand that I may be removed
              from the event for failing to do so. This waiver is required to attend Hack 4 Social Good
              2027.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={waiver}
              onChange={(e) => setWaiver(e.target.checked)}
              className={checkboxClass}
            />
            I have read and agree to the Liability Waiver. *
          </label>

          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <p className="font-medium">Photo &amp; Media Release</p>
            <p>
              I grant Hack 4 Social Good, its organizers, and its sponsors and partners permission to
              photograph, film, and record me during Hack 4 Social Good 2027, and to use, reproduce,
              publish, and distribute those photographs, videos, and recordings, including my name
              and likeness in them, in any media (including websites, social media, print, and
              promotional or marketing materials) without compensation or further approval. I
              understand that sponsors may take photos and video of hackers at the event and may use
              them for their own promotional and marketing purposes. I release Hack 4 Social Good, its
              organizers, and its sponsors and partners from any claims arising from these uses.
              This release is optional. You may attend without consenting to photography or video.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={photoRelease}
              onChange={(e) => setPhotoRelease(e.target.checked)}
              className={checkboxClass}
            />
            I consent to the Photo &amp; Media Release (optional).
          </label>
        </>
      )}

      {attending && (
        <p className="text-xs text-gray-500">
          Submitting confirms your decision to attend Hack 4 Social Good, and you won&apos;t be able to make
          changes afterwards.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-green-100 px-4 py-2 text-green-900 shadow-sm transition-colors duration-300 hover:bg-green-200 disabled:bg-green-200"
      >
        {submitting ? "Submitting..." : attending || !confirmed ? "Confirm Attendance" : "Submit"}
      </button>
    </form>
  );
}
