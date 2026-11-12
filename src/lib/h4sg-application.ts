import { z } from "zod";

// Additional questions from https://tally.so/r/jeZW04. Existing application
// fields remain separate so drafts and previously submitted answers survive.
export type H4sgDetails = Record<string, string | string[] | undefined>;
export interface H4sgField {
  key: string;
  label: string;
  group: string;
  kind?: "text" | "email" | "textarea" | "select" | "multi" | "teammates";
  options?: string[];
  help?: string;
  maxWords?: number;
  when?: { key: string; value: string };
}

export const H4SG_FIELDS: H4sgField[] = [
  { key: "full_name", label: "Full name (first and last)", group: "General information" },
  { key: "school_email", label: "School email", kind: "email", group: "General information", help: "This can differ from the email you use to sign in." },
  { key: "class_year", label: "Class year", group: "General information", help: "2027, 2028, 2029, 2030, or describe another class year." },
  { key: "over_18", label: "Are you 18 or older?", kind: "select", options: ["Yes", "No"], group: "General information", help: "You must be 18 or older to participate." },
  { key: "full_attendance", label: "Can you attend the full hackathon (March 5–7, 2027)?", kind: "select", options: ["Yes", "No"], group: "General information", help: "Full attendance is expected. Disclose any exceptions in advance; requests are considered case by case." },
  { key: "attendance_explanation", label: "Please explain any attendance exceptions", kind: "textarea", group: "General information", when: { key: "full_attendance", value: "No" } },
  { key: "dietary_notes", label: "Dietary restrictions or allergies", kind: "textarea", group: "General information", help: "Include any additional needs; write N/A if none. Your existing dietary selections are also retained." },
  { key: "sponsor_sharing", label: "May we share your contact information and resume with sponsors for internship, recruiting, and professional development opportunities?", kind: "select", options: ["Yes", "No", "Other"], group: "General information" },
  { key: "sponsor_sharing_other", label: "Describe your sponsor-sharing preference", kind: "textarea", group: "General information", when: { key: "sponsor_sharing", value: "Other" } },
  { key: "application_mode", label: "Are you applying individually or in a group?", kind: "select", options: ["Group", "Individually"], group: "Team preferences" },
  { key: "preferred_teammates", label: "Preferred teammates (full names)", kind: "teammates", group: "Team preferences", when: { key: "application_mode", value: "Group" }, help: "List up to three other members. Every member must submit their own application; including you, the team may have at most four members." },
  { key: "individual_plan", label: "If applying individually, do you plan to form a group or participate individually?", kind: "select", options: ["Group", "Individually"], group: "Team preferences", when: { key: "application_mode", value: "Individually" } },
  { key: "coding_ability", label: "How would you rate your coding ability (1–10)?", kind: "select", options: ["1 – No coding experience", "2 – Very limited exposure; have tried basic tutorials or exercises", "3 – Beginner; familiar with basic programming concepts", "4 – Some coursework or small personal/class projects", "5 – Comfortable writing and debugging code for moderately sized projects", "6 – Able to build projects independently using common tools, libraries, and frameworks", "7 – Strong coding experience through substantial coursework, projects, research, or internships", "8 – Advanced; comfortable designing and implementing complex technical projects", "9 – Very advanced; extensive project, research, internship, or professional development experience", "10 – Expert-level; able to architect complex systems and lead technical development"], group: "Experience and skills", help: "Experience is not required. Honest answers help us tailor workshops to participants’ skills." },
  { key: "built_project", label: "Tell us about something you have built or worked on. What did you make, and what was your role?", kind: "textarea", maxWords: 150, group: "Experience and skills", help: "Class projects, personal projects, hackathons, and club initiatives all count." },
  { key: "tools", label: "Which tools or technologies have you used?", kind: "multi", options: ["Python", "JavaScript/TypeScript", "React/React Native", "Java", "SQL", "Git/GitHub", "Figma", "ML/AI tools", "Other"], group: "Experience and skills", help: "If none yet, select Other and write ‘No prior experience’." },
  { key: "tools_other", label: "Other tools or technologies", group: "Experience and skills", when: { key: "tools", value: "Other" } },
  { key: "social_issue", label: "What social issue would you most want to work on, and why?", kind: "textarea", maxWords: 150, group: "Interests and goals" },
  { key: "team_contribution", label: "How do you see yourself contributing to a team?", kind: "textarea", maxWords: 150, group: "Interests and goals" },
  { key: "social_impact_idea", label: "If you had unlimited resources, what would you build to make a positive social impact?", kind: "textarea", maxWords: 100, group: "Interests and goals" },
  { key: "workshops", label: "Would you attend workshops on technical skills, design, entrepreneurship, social impact, or career development?", kind: "select", options: ["Yes", "No", "Depends"], group: "Hackathon events" },
  { key: "curated_coffee_chats", label: "Are you interested in curated coffee chats matched by shared interests, goals, or backgrounds?", kind: "select", options: ["Yes", "No", "Maybe"], group: "Hackathon events", help: "Matches may include participants, mentors, sponsors, or professionals. Your answer is nonbinding and helps us decide whether to reach out." },
  { key: "open_coffee_chats", label: "Are you interested in informal, open coffee chats without a predetermined match?", kind: "select", options: ["Yes", "No", "Maybe"], group: "Hackathon events" },
  { key: "referral_sources", label: "How did you hear about this event? Select all that apply.", kind: "multi", options: ["T4SG email or newsletter", "T4SG social media", "Harvard student organization or mailing list", "Friend or classmate", "Professor, advisor, or school administrator", "Another hackathon or student event", "Sponsor or partner organization", "Website or online search", "Other"], group: "Administrative" },
  { key: "referral_other", label: "Other referral source", group: "Administrative", when: { key: "referral_sources", value: "Other" } },
  { key: "event_code_of_conduct", label: "I have read and agree to follow the event Code of Conduct throughout the hackathon", kind: "select", options: ["I agree"], group: "Administrative", help: "Help create a welcoming, respectful, inclusive event. Review the linked Code of Conduct before agreeing." },
  { key: "photo_consent", label: "Photography and video consent", kind: "select", options: ["I consent", "I do not consent"], group: "Administrative", help: "Photos and video may be used for event documentation, promotional materials, social media, and future T4SG communications. Either choice is accepted." },
];

export function isH4sgFieldVisible(field: H4sgField, details: H4sgDetails) {
  if (!field.when) return true;
  const value = details[field.when.key];
  return Array.isArray(value) ? value.includes(field.when.value) : value === field.when.value;
}

export function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

const draftSchema = z.object(Object.fromEntries(H4SG_FIELDS.map((field) => [
  field.key,
  (field.kind === "multi" || field.kind === "teammates"
    ? z.array(z.string().trim().max(200)).max(field.kind === "teammates" ? 3 : 20)
    : z.string().trim().max(10000)).optional(),
]))).strict();

export function validateH4sgDetails(input: unknown): { details?: H4sgDetails; error?: string } {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { error: "Some H4SG answers have an invalid format or exceed the allowed length." };
  const details = parsed.data as H4sgDetails;
  for (const field of H4SG_FIELDS) {
    if (!isH4sgFieldVisible(field, details)) continue;
    const value = details[field.key];
    // Teammate preferences are optional, just as in the source form.
    if (field.kind === "teammates") continue;
    if (!value || (Array.isArray(value) ? !value.length : !value.trim())) return { error: `Please answer: ${field.label}` };
    if (field.kind === "email" && !z.email().safeParse(value).success) return { error: "Please enter a valid school email." };
    if (field.options?.length) {
      const values = Array.isArray(value) ? value : [value];
      if (values.some((v) => !field.options!.includes(v))) return { error: `Please select a valid option for: ${field.label}` };
    }
    if (field.maxWords && typeof value === "string" && wordCount(value) > field.maxWords) return { error: `${field.label} must be ${field.maxWords} words or fewer.` };
  }
  if (details.over_18 !== "Yes") return { error: "You must be 18 or older to participate in Hack 4 Social Good." };
  return { details };
}
