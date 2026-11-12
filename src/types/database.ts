import type { H4sgDetails } from "@/lib/h4sg-application";

export type Role = "applicant" | "reviewer" | "admin" | "checkin";

export type DecisionType = "accepted" | "waitlisted" | "rejected";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  hhid: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  email: string;
  // Personal
  age: number | null;
  gender: string | null;
  race: string[];
  underrepresented: string | null;
  phone: string | null;
  country: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  address_country: string | null;
  dietary_restrictions: string[];
  dietary_other: string | null;
  // Academic
  enrolled: boolean | null;
  school: string | null;
  graduation_year: number | null;
  major: string | null;
  level_of_study: string | null;
  harvard_affiliated: boolean | null;
  // Hackathon
  shirt_size: string | null;
  first_hackathon: boolean | null;
  previously_participated: boolean | null;
  able_to_attend: boolean | null;
  referral_source: string | null;
  // Open Response
  team_roles: string[];
  other_role: string | null;
  programming_languages: string[];
  other_language: string | null;
  experience: string | null;
  essay_why_hh: string | null;
  essay_project: string | null;
  essay_unlimited_resource: string | null;
  essay_space: string | null;
  financial_aid: boolean;
  financial_aid_detail: string | null;
  resume_url: string | null;
  resume_name: string | null;
  resume_share: boolean | null;
  // Additional H4SG application answers (migration 019)
  h4sg_details: H4sgDetails;
  // Agreements
  code_of_conduct: boolean;
  data_sharing: boolean;
  mlh_emails: boolean;
  // Meta
  submitted: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Decision {
  id: string;
  type: DecisionType;
  released: boolean;
  decided_by: string | null;
  decided_at: string;
  released_at: string | null;
  notified_at: string | null;
  notify_error: string | null;
}

export interface Confirmation {
  id: string;
  confirmed: string;
  travel_plans: string | null;
  waiver: boolean;
  photo_release: boolean;
  full_name: string | null;
  email: string | null;
  building_startup: boolean | null;
  startup_stage: string | null;
  submitted_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface InviteToken {
  id: string;
  role: "reviewer" | "admin";
  expires_at: string;
  consumable: boolean;
  consumers: string[];
  created_by: string | null;
  created_at: string;
}

export interface Checkin {
  id: string;
  checked_in: boolean;
  checked_in_at: string | null;
  checked_in_by: string | null;
}

export interface MatchingCode {
  id: string;
  code: string;
  created_at: string;
}

export interface DecisionRelease {
  id: string;
  released_by: string | null;
  decision_ids: string[];
  released_at: string;
  notes: string | null;
}

export interface ClaudeCreditCode {
  code: string;
  signup_link: string;
  assigned_to: string | null;
  assigned_at: string | null;
  created_at: string;
}

export interface JudgingAssignment {
  email: string;
  project_name: string;
  table_location: string;
  track: string | null;
  time_slot: string | null;
  judges: string[];
  updated_at: string;
}
