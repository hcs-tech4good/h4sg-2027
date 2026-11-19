import type { Application } from "@/types/database";

// Required answers outside the H4SG Details section, checked in section order so the
// form can jump to the first one missing. Shared by the form and submitApplication.
export const US_COUNTRY = "United States of America";

type RequiredFields = Pick<Application,
  | "gender" | "underrepresented" | "phone" | "country" | "race"
  | "address_line1" | "city" | "address_country" | "state" | "zip"
  | "level_of_study" | "school" | "major" | "shirt_size"
  | "team_roles" | "other_role" | "financial_aid" | "financial_aid_detail" | "resume_url">;

const filled = (value: string | null | undefined) => !!value?.trim();

export function findMissingApplicationField(app: RequiredFields): { section: number; message: string } | null {
  const checks: [number, boolean, string][] = [
    [0, filled(app.gender), "Gender"],
    [0, filled(app.underrepresented), "Underrepresented group"],
    [0, filled(app.phone), "Phone number"],
    [0, filled(app.country), "Country of residence"],
    [0, (app.race?.length ?? 0) > 0, "Race/ethnicity"],
    [0, filled(app.address_line1), "Shipping address"],
    [0, filled(app.city), "City"],
    [0, filled(app.address_country), "Shipping country"],
    [0, app.address_country !== US_COUNTRY || filled(app.state), "State"],
    [0, filled(app.zip), "Zip code"],
    [1, filled(app.level_of_study), "Education level"],
    [1, filled(app.school), "Current school"],
    [1, filled(app.major), "Major / field of study"],
    [2, filled(app.shirt_size), "Shirt size"],
    [3, (app.team_roles?.length ?? 0) > 0, "Hackathon team roles"],
    [3, !app.team_roles?.includes("Other") || filled(app.other_role), "Other role description"],
    [3, !app.financial_aid || filled(app.financial_aid_detail), "Financial situation description"],
    [3, filled(app.resume_url), "Resume"],
  ];
  const missing = checks.find(([, ok]) => !ok);
  return missing ? { section: missing[0], message: `Please answer: ${missing[2]}` } : null;
}
