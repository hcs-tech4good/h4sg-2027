"use client";

import { ArrowRight, ArrowLeft, Save, Send, CheckCircle2 } from "lucide-react";
import { MarineIcon, type MarineKind } from "@/components/marine-art";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { submitApplication } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GENDERS,
  RACES,
  LEVELS_OF_STUDY,
  MAJORS,
  SHIRT_SIZES,
  ROLES,
  STATES,
  COUNTRIES,
  SCHOOLS,
  UNDERREPRESENTED_OPTIONS,
  MAX_PROLANGS,
} from "@/data";
import { H4sgApplicationFields } from "@/components/h4sg-application-fields";
import { validateH4sgDetails } from "@/lib/h4sg-application";
import { findMissingApplicationField, US_COUNTRY } from "@/lib/application-requirements";
import type { Application } from "@/types/database";

const DEADLINE = new Date(process.env.NEXT_PUBLIC_APP_CLOSES || 0);
const AUTOSAVE_DELAY_MS = 2000;
const SAVE_ERROR = "Could not save your draft. Please try again.";
const SETUP_ERROR = "Database setup is incomplete. Apply migration 019_h4sg_application_details.sql before saving.";

interface ApplicationFormProps {
  userId: string;
  email: string;
  defaultName: string;
  existingApplication: Application | null;
}

type FormData = Omit<Application, "id" | "created_at" | "updated_at" | "submitted_at">;

export function ApplicationForm({
  userId,
  email,
  defaultName,
  existingApplication,
}: ApplicationFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const isSubmitted = existingApplication?.submitted || false;
  const isPastDeadline = new Date() > DEADLINE;

  const [section, setSection] = useState(0);
  const previousSection = useRef(section);
  useEffect(() => {
    if (previousSection.current === section) return;
    previousSection.current = section;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("application-body")?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
  }, [section]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState<FormData>({
    email,
    h4sg_details: {
      full_name: defaultName,
      school_email: email,
      class_year: existingApplication?.graduation_year?.toString() || "",
      ...existingApplication?.h4sg_details,
    },
    age: existingApplication?.age ?? null,
    gender: existingApplication?.gender ?? null,
    race: existingApplication?.race || [],
    underrepresented: existingApplication?.underrepresented ?? null,
    phone: existingApplication?.phone ?? null,
    country: existingApplication?.country ?? null,
    address_line1: existingApplication?.address_line1 ?? null,
    address_line2: existingApplication?.address_line2 ?? null,
    city: existingApplication?.city ?? null,
    state: existingApplication?.state ?? null,
    zip: existingApplication?.zip ?? null,
    address_country: existingApplication?.address_country ?? null,
    dietary_restrictions: existingApplication?.dietary_restrictions || [],
    dietary_other: existingApplication?.dietary_other ?? null,
    enrolled: existingApplication?.enrolled ?? null,
    school: existingApplication?.school ?? null,
    graduation_year: existingApplication?.graduation_year ?? null,
    major: existingApplication?.major ?? null,
    level_of_study: existingApplication?.level_of_study ?? null,
    harvard_affiliated: existingApplication?.harvard_affiliated ?? null,
    shirt_size: existingApplication?.shirt_size ?? null,
    first_hackathon: existingApplication?.first_hackathon ?? null,
    previously_participated: existingApplication?.previously_participated ?? null,
    able_to_attend: existingApplication?.able_to_attend ?? null,
    referral_source: existingApplication?.referral_source ?? null,
    team_roles: existingApplication?.team_roles || [],
    other_role: existingApplication?.other_role ?? null,
    programming_languages: existingApplication?.programming_languages || [],
    other_language: existingApplication?.other_language ?? null,
    experience: existingApplication?.experience ?? null,
    essay_why_hh: existingApplication?.essay_why_hh ?? null,
    essay_project: existingApplication?.essay_project ?? null,
    essay_unlimited_resource: existingApplication?.essay_unlimited_resource ?? null,
    essay_space: existingApplication?.essay_space ?? null,
    financial_aid: existingApplication?.financial_aid || false,
    financial_aid_detail: existingApplication?.financial_aid_detail ?? null,
    resume_url: existingApplication?.resume_url ?? null,
    resume_name: existingApplication?.resume_name ?? null,
    resume_share: existingApplication?.resume_share ?? null,
    code_of_conduct: existingApplication?.code_of_conduct || false,
    data_sharing: existingApplication?.data_sharing || false,
    mlh_emails: existingApplication?.mlh_emails || false,
    submitted: existingApplication?.submitted || false,
  });

  const saveDraft = useCallback(async () => {
    if (isSubmitted) return;
    setSaving(true);
    // Never send `submitted`: a late autosave must not flip a submitted application back to a draft.
    const payload: Record<string, unknown> = { ...form, id: userId };
    delete payload.submitted;

    // Upsert on the primary key so repeated saves (manual, auto-save, pre-submit)
    // never collide — avoids duplicate-key errors from a stale existing-row flag.
    const { error } = await supabase
      .from("applications")
      .upsert(payload, { onConflict: "id" });

    setSaving(false);
    if (!error) {
      setLastSaved(new Date());
      setError((e) => (e === SAVE_ERROR || e === SETUP_ERROR ? "" : e));
    } else setError(error.message.includes("h4sg_details")
      ? SETUP_ERROR
      : SAVE_ERROR);
    return !error;
  }, [form, userId, isSubmitted, supabase]);

  // Autosave a couple of seconds after the applicant stops changing answers.
  const firstRender = useRef(true);
  const submittingRef = useRef(false);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (isSubmitted || submittingRef.current) return;
    const timer = setTimeout(() => { if (!submittingRef.current) saveDraft(); }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [form, saveDraft, isSubmitted]);

  function toggleArray(field: "race" | "dietary_restrictions" | "team_roles" | "programming_languages", value: string, checked: boolean) {
    setForm((f) => {
      const current = f[field];
      if (checked) {
        if (field === "programming_languages" && current.length >= MAX_PROLANGS && !current.includes(value)) {
          return f;
        }
        return { ...f, [field]: [...current, value] };
      }
      return { ...f, [field]: current.filter((x) => x !== value) };
    });
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Resume must be under 10 MB");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Resume must be a PDF");
      return;
    }

    const path = `${userId}/resume.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError("Failed to upload resume");
      return;
    }

    setForm((f) => ({ ...f, resume_url: path, resume_name: file.name }));
    setError("");
  }

  async function handleSubmit() {
    setError("");
    const missing = findMissingApplicationField(form);
    if (missing) {
      setError(missing.message);
      setSection(missing.section);
      return;
    }
    const additional = validateH4sgDetails(form.h4sg_details);
    if (additional.error) {
      setError(additional.error);
      setSection(4);
      return;
    }
    if (
      form.harvard_affiliated &&
      !form.email.toLowerCase().includes("harvard")
    ) {
      setError(
        "You indicated Harvard affiliation, but your email is not a Harvard email. Please update your email on your profile."
      );
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    const saved = await saveDraft();
    if (!saved) {
      setError("Failed to save your application. Please try again.");
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }

    try {
      await submitApplication(userId);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit. Please try again.";
      setError(message);
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const sections = ["Personal", "Academic", "Hackathon", "Roles & resume", "H4SG details"];

  if (isSubmitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application Submitted</CardTitle>
          <CardDescription>
            Submitted on {new Date(existingApplication!.submitted_at!).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          Your application has been submitted successfully. You can view your status on the dashboard.
        </CardContent>
      </Card>
    );
  }

  if (isPastDeadline) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Applications Closed</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          The application deadline has passed.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="application-workbench">
      <div className="application-section-sidebar" aria-label="Application sections">
        <div className="application-step-caption"><span>Make yourself at home. You can save and come back.</span><span>Section {section + 1} of {sections.length}</span></div>
        <nav aria-label="Application steps">{sections.map((name, index) => <button type="button" key={name} onClick={() => setSection(index)} aria-current={section === index ? "step" : undefined} className={section === index ? "application-step is-active" : "application-step"}><MarineIcon kind={(["fish", "shell", "turtle", "jellyfish", "coral"] as MarineKind[])[index]} /><strong>{name}</strong></button>)}</nav>
      </div>
      <div id="application-body" className="application-body space-y-5">
      <div className="application-save-reminder" role="note">
        <Save size={18} aria-hidden="true" />
        <p><strong>Your answers save automatically</strong> a couple of seconds after you stop typing. Check for “Saved” at the bottom before you leave, or click <strong>Save draft</strong> to save right away. All questions marked * are required.</p>
      </div>
      {error && (
        <div role="alert" className="application-error">{error}</div>
      )}

      {/* Personal Section */}
      {section === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="marine-card-title"><MarineIcon kind="fish" />Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Gender *</Label>
                <Select
                  value={form.gender || ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, gender: v || null }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Do you identify as part of an underrepresented group in the technology industry? *</Label>
                <Select
                  value={form.underrepresented || ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, underrepresented: v || null }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {UNDERREPRESENTED_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input
                  value={form.phone || ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Country of Residence *</Label>
                <Combobox
                  value={form.country || ""}
                  onChange={(v) => setForm((f) => ({ ...f, country: v }))}
                  options={COUNTRIES}
                  placeholder="Select..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Race/Ethnicity (check all that apply) *</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {RACES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.race.includes(r)}
                      onCheckedChange={(c) => toggleArray("race", r, !!c)}
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Shipping Address *</Label>
              <Input
                placeholder="Address line 1"
                value={form.address_line1 || ""}
                onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Address line 2 (optional)"
                value={form.address_line2 || ""}
                onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>City *</Label>
                <Input
                  value={form.city || ""}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Country *</Label>
                <Combobox
                  value={form.address_country || ""}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      address_country: v,
                      // State only applies to US addresses
                      state: v === US_COUNTRY ? f.state : null,
                    }))
                  }
                  options={COUNTRIES}
                  placeholder="Select..."
                />
              </div>
              {form.address_country === US_COUNTRY && (
                <div className="space-y-2">
                  <Label>State *</Label>
                  <Combobox
                    value={form.state || ""}
                    onChange={(v) => setForm((f) => ({ ...f, state: v }))}
                    options={STATES}
                    placeholder="Select..."
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Zip Code *</Label>
                <Input
                  value={form.zip || ""}
                  onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Academic Section */}
      {section === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="marine-card-title"><MarineIcon kind="shell" />Academic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>What is your current education level? *</Label>
              <Select
                value={form.level_of_study || ""}
                onValueChange={(v) => setForm((f) => ({ ...f, level_of_study: v || null }))}
              >
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {LEVELS_OF_STUDY.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.enrolled || false}
                onCheckedChange={(c) => setForm((f) => ({ ...f, enrolled: !!c }))}
              />
              Will you be pursuing an undergraduate degree program at a university on March 5th, 2027?
            </label>
            <div className="space-y-2">
              <Label>Current School *</Label>
              <Combobox
                value={form.school || ""}
                onChange={(v) => setForm((f) => ({ ...f, school: v }))}
                options={SCHOOLS}
                placeholder="Search for your school..."
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Major / Field of Study *</Label>
                <Input list="major-options" aria-label="Major or concentration" value={form.major || ""}
                  onChange={(e) => setForm((f) => ({ ...f, major: e.target.value }))} />
                <datalist id="major-options">{MAJORS.map((m) => <option key={m} value={m} />)}</datalist>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.harvard_affiliated || false}
                onCheckedChange={(c) => setForm((f) => ({ ...f, harvard_affiliated: !!c }))}
              />
              Are you affiliated with Harvard University? If so, make sure your profile uses your Harvard email.
            </label>
          </CardContent>
        </Card>
      )}

      {/* Hackathon Section */}
      {section === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="marine-card-title"><MarineIcon kind="turtle" />Hackathon Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shirt Size *</Label>
              <Select
                value={form.shirt_size || ""}
                onValueChange={(v) => setForm((f) => ({ ...f, shirt_size: v || null }))}
              >
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {SHIRT_SIZES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.first_hackathon || false}
                onCheckedChange={(c) =>
                  setForm((f) => ({
                    ...f,
                    first_hackathon: !!c,
                    previously_participated: c ? false : f.previously_participated,
                  }))
                }
              />
              Will Hack 4 Social Good be your first hackathon?
            </label>
            {form.first_hackathon === false && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.previously_participated || false}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, previously_participated: !!c }))}
                />
                Have you previously participated at a Hack 4 Social Good hackathon?
              </label>
            )}
          </CardContent>
        </Card>
      )}

      {/* Roles & Resume Section */}
      {section === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="marine-card-title"><MarineIcon kind="jellyfish" />Roles &amp; Resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>What roles could you see yourself playing on a hackathon team? (check all that apply) *</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.team_roles.includes(r)}
                      onCheckedChange={(c) => toggleArray("team_roles", r, !!c)}
                    />
                    {r}
                  </label>
                ))}
              </div>
              {form.team_roles.includes("Other") && (
                <Textarea
                  placeholder="If other, what other roles could you see yourself playing? (200 char limit)"
                  maxLength={200}
                  value={form.other_role || ""}
                  onChange={(e) => setForm((f) => ({ ...f, other_role: e.target.value }))}
                />
              )}
            </div>

            {/* Financial accommodations */}
            <div className="space-y-2 rounded-md bg-gray-100 p-3">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={form.financial_aid || false}
                  onCheckedChange={(c) =>
                    setForm((f) => ({ ...f, financial_aid: !!c }))
                  }
                  className="mt-0.5"
                />
                <span>
                  This year, Hack 4 Social Good does <strong>not</strong> provide overnight
                  accommodations. If you anticipate needing financial help (for example,
                  transportation), check this box and describe your situation below. Checking
                  this box means we will send you the separate financial accommodations
                  application and be aware of your situation. It does <strong>not</strong>{" "}
                  guarantee financial help &mdash; accommodations are awarded through a
                  lottery system and are not guaranteed. If you do not check it, you forfeit
                  the right to apply for financial accommodations.
                </span>
              </label>
              {form.financial_aid && (
                <Textarea
                  placeholder="Please describe your financial situation and what kind of help you may need (e.g. transportation)."
                  maxLength={1000}
                  rows={3}
                  value={form.financial_aid_detail || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, financial_aid_detail: e.target.value }))
                  }
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Upload your resume (max 10 MB; PDF) *</Label>
              {form.resume_name && (
                <p className="text-sm text-green-700">Uploaded: {form.resume_name}</p>
              )}
              <Input type="file" accept="application/pdf" onChange={handleResumeUpload} />
              <p className="text-xs text-gray-400">Your resume is stored privately. Save your draft after uploading to keep the attachment linked to your application.</p>
            </div>
            <p className="text-sm text-gray-600">Set your resume and contact-sharing preference in H4SG Details. Your resume is private; it does not need to be publicly accessible.</p>
          </CardContent>
        </Card>
      )}

      {section === 4 && (
        <H4sgApplicationFields value={form.h4sg_details} onChange={(key, answer) => setForm((f) => ({
          ...f,
          h4sg_details: { ...f.h4sg_details, [key]: answer },
          ...(key === "sponsor_sharing" ? { resume_share: answer === "Yes" } : {}),
          ...(key === "full_attendance" ? { able_to_attend: answer === "Yes" } : {}),
          ...(key === "event_code_of_conduct" ? { code_of_conduct: answer === "I agree" } : {}),
        }))} />
      )}

      {/* Actions */}
      <div className="application-actions">
        <div className="flex gap-2">
          {section > 0 && (
            <Button variant="outline" onClick={() => setSection(section - 1)}>
              <ArrowLeft size={15} /> Back
            </Button>
          )}
          {section < sections.length - 1 && (
            <Button onClick={() => setSection(section + 1)}>Continue <ArrowRight size={15} /></Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {lastSaved && (
            <p className="application-saved" role="status"><CheckCircle2 size={14} />Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          )}
          <Button variant="outline" onClick={saveDraft} disabled={saving}>
            <Save size={15} />{saving ? "Saving…" : "Save draft"}
          </Button>
          {section === sections.length - 1 && (
            <Button onClick={handleSubmit} disabled={submitting}>
              <Send size={15} />{submitting ? "Submitting…" : "Submit application"}
            </Button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
