import genders from "./genders.json";
import races from "./race.json";
import dietaryRestrictions from "./dietaryRestrictions.json";
import levelOfStudy from "./levelOfStudy.json";
import majors from "./major.json";
import shirtSizes from "./shirtSizes.json";
import reasons from "./reasons.json";
import roles from "./roles.json";
import prolangs from "./prolangs.json";
import experience from "./experience.json";
import states from "./states.json";
import world from "./world.json";
import schools from "./schools.json";

type Named = { name: string };

// Map to names and de-duplicate (some source lists, e.g. schools.json,
// contain repeated entries which would produce duplicate React keys).
const names = (arr: Named[]) => Array.from(new Set(arr.map((x) => x.name)));

export const GENDERS = names(genders as Named[]);
export const RACES = names(races as Named[]);
export const DIETARY_RESTRICTIONS = names(dietaryRestrictions as Named[]);
export const LEVELS_OF_STUDY = names(levelOfStudy as Named[]);
export const MAJORS = names(majors as Named[]);
export const SHIRT_SIZES = names(shirtSizes as Named[]);
export const REASONS = names(reasons as Named[]);
export const ROLES = names(roles as Named[]);
export const PROLANGS = names(prolangs as Named[]);
export const EXPERIENCE_LEVELS = names(experience as Named[]);
export const STATES = names(states as Named[]);
export const COUNTRIES = names(world as Named[]);
export const SCHOOLS = names(schools as Named[]);

export const UNDERREPRESENTED_OPTIONS = ["Yes", "No", "Unsure"];

export const ATTENDANCE_OPTIONS = [
  "Yes, I can attend all 3 days of Hack 4 Social Good.",
  "No, unfortunately I cannot.",
];

export const STARTUP_STAGE_OPTIONS = [
  "Already raised funding",
  "Currently building a startup / looking to raise",
  "Pre-incorporation / exploring startup ideas",
];

export const MAX_PROLANGS = 5;
