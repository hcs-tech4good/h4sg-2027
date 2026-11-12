// Shared by the check-in station UI and its server actions.

export type RegistrationStatus = "coming" | "not_coming" | "not_registered";

export type StationResult =
  | {
      status: "checked_in" | "already_checked_in";
      userId: string;
      name: string;
      hhid: string;
      shirtSize: string | null;
      registration: RegistrationStatus;
      checkedInAt: string;
    }
  | {
      status: "not_accepted";
      name: string;
      hhid: string;
      decision: "waitlisted" | "rejected" | "staged" | "none" | string;
    }
  // No hacker matches this token, or this Hacker ID + last name.
  | { status: "unknown" }
  // The QR code isn't a Hack 4 Social Good check-in code at all.
  | { status: "not_our_code" }
  // Bad manual input, or the server couldn't be reached.
  | { status: "invalid"; message: string };

export interface StationStats {
  checkedIn: number;
  accepted: number;
}

// Imported tokens and portal-issued tokens share this shape.
export const CHECKIN_TOKEN_RE = /^HKP_[0-9A-Z]{32}$/;

export { normalizeHackerId } from "./hacker-id";
