# Hack 4 Social Good

H4SG's public landing page and applicant/staff portal, built with Next.js and Supabase.
The homepage announces March 5–7, 2027 in Cambridge, MA.

## Local setup

Use Node.js 20.9+ and npm. Copy `.env.example` to `.env.local`, then fill in your
Supabase project URL, anon key, and service role key. Apply all SQL migrations in
`supabase/migrations` in numerical order to a new Supabase project.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The homepage is public; Portal links lead to the
protected dashboard and Apply links lead to signup. Existing users can sign in
from signup. `/portal` also redirects to the dashboard. Portal logos and the
footer link back to the homepage.

Set both application date variables to your actual application window; without
both, the application page remains closed. Set `NEXT_PUBLIC_SITE_URL` to the
actual origin in production so email links and logos resolve correctly.
Configure Supabase Auth's Site URL and allowed password-reset redirect to match
(`http://localhost:3000` and `http://localhost:3000/update-password` locally).

Postmark app emails are optional. Set a verified `EMAIL_FROM` sender and
`POSTMARK_API_TOKEN` to enable them. Supabase confirmation/password reset emails
use separate SMTP settings in the Supabase dashboard. Update Supabase-hosted
email templates and sender branding there as well.

## Source and branding

- `public/landing.html` preserves the supplied standalone homepage, including its
  styles, countdown, and ocean animation. `src/app/route.ts` serves it at `/`,
  isolated from portal CSS. It uses Google Fonts and Three.js from a CDN.
- `public/h4sg-logo.png` is the supplied logo. The same artwork is used for app
  icons and `public/email-logo.png`.
- Portal UI and app-generated emails use Hack 4 Social Good / H4SG branding and
  the `operations@t4sg.dev` contact from the supplied homepage.
- Existing HH account IDs, check-in token formats, and historical SQL migrations
  are preserved for data compatibility. The existing teammate matching service
  URL is retained until a replacement is provided.

## Checks and production

```sh
npx tsc --noEmit
npm run build
npm run start
```

## H4SG application update (migration 019)

Before running this version against an existing Supabase project, apply
`supabase/migrations/019_h4sg_application_details.sql` in the SQL Editor.
It adds the `h4sg_details` JSONB column and raises the private resume bucket's
limit to 10 MB. Existing drafts and submitted applications are retained;
previously submitted applicants do not have to reapply. New submissions must
complete the additional H4SG questions from https://tally.so/r/jeZW04.

The added questions cover school email, full name/class year, adult eligibility,
full attendance and exceptions, dietary notes, contact/resume-sharing preferences,
team formation and up to three preferred teammates, coding ability, technologies,
project and social-impact essays (150/100-word limits), workshops, coffee chats,
referral sources, event conduct, and optional photography consent. Existing phone,
university, major, and resume fields are reused. Applicant summaries, staff review,
and CSV exports include the new answers. Declining photography does not block
application or attendance confirmation.

Displayed IDs and CSV column headers now use Hacker ID / `hacker_id`. The database
column `profiles.hhid` and RPC parameters retain their internal names for API
compatibility. Migration 020 changes the displayed prefix as described below.

Validate the additional-question rules with:

```sh
node --experimental-strip-types --test tests/h4sg-application.test.mjs
```

The test command requires a Node version supporting TypeScript type stripping
(Node 22.6+); the app itself still supports Node 20.9+.

## Neutral Hacker IDs (migration 020)

Apply `supabase/migrations/020_neutral_hacker_id_prefix.sql` in Supabase SQL Editor.
It converts existing `HH-1234567` IDs to `H-1234567`, preserving the seven digits,
and updates the signup trigger so new accounts use `H-` as well. Account UUIDs,
relationships, and secret check-in QR tokens are unchanged. Check-in accepts
`H-1234567`, legacy `HH-1234567`, or just `1234567`, including lowercase and spaces.

The migration is transactional and rerunnable. If an existing H- account already
uses a legacy account's numeric suffix, it aborts before changing anything rather
than creating ambiguous IDs. Resolve that collision before rerunning it.

Test ID generation and compatibility with:

```sh
node --experimental-strip-types --test tests/hacker-id.test.mjs
```

## Portal design

The portal shares the homepage's Bricolage Grotesque / DM Sans typography,
light aqua background, mint controls, and rounded forms. A simple top navigation
replaces the sidebar. The application uses compact section tabs, and dashboard
content focuses on status, next steps, and Hacker ID. Mobile navigation supports
Escape dismissal, a skip link, focus states, and reduced-motion preferences.
The shared `PortalShell` and scoped `src/app/portal.css` apply these styles.
This visual update requires no additional database migration.

## Ocean background

The standalone homepage uses the Three.js ocean from the supplied
`h4sg-website-copy1.html`, with sunlight beams extended above the viewport so
their rectangular tops stay out of view. The countdown window retains its gold rim. `public/ocean-zones.css` styles
the content over the water, without masking or replacing the 3D scene.

`public/ocean-foreground.js` draws a separate decorative 2D canvas: slow twisting
water currents, occasional fish schools crossing at alternating angles, periodic
faster current and bubble rushes on a separate staggered cycle, and
jellyfish toward the bottom that bob and shift glow color. The canvas ignores
pointer input, pauses in hidden tabs, and shows static texture with no fish
rushes for reduced-motion users. Slow currents use fixed page anchors and scroll with the background. Passing
fish, bubble and water rushes use viewport coordinates independently of scrolling.
Jellyfish form a stable set piece anchored before FAQ answers; opening a
disclosure does not recalculate their positions from the document height. The
3D camera scroll range likewise stays stable across FAQ interactions. Fish have animated tails and
schooling motion; current ripples carry moving particles and bubble streams
wobble and shimmer. Water and bubble rushes use flatter angles than fish. The script is explicitly public in middleware.

The depth meter retains its high-contrast navy surface and gentle red beacon,
which stays steady for reduced-motion users. Landing-page FAQ disclosures use
native keyboard-accessible details/summary elements.

## Portal marine artwork

`src/components/marine-art.tsx` contains reusable, original SVG fish, jellyfish,
shell, starfish, turtle, and coral illustrations. Page headings include a small
animated group of ocean companions; application tabs, form headings, dashboard
status steps, and the footer share the same artwork. The SVGs are decorative,
ignore pointer input, and are hidden from assistive technology. Motion is disabled
for reduced-motion preferences, and artwork scales down on narrow screens.

## Landing page logo introduction

`public/logo-intro.css` and `public/logo-intro.js` animate a small slit into two
branches, unfold clipped halves of the supplied logo, and tilt the assembled
mark before diagonal light lines swipe across the screen, clipping away both
the logo and backdrop to reveal the landing page. Bubbles follow in their wake. The final frame uses the untouched
`public/h4sg-logo.png` (identical to the supplied PNG). The sequence takes about
1.8 seconds after image decoding and replays on every page load or refresh. Visitors can
skip it with the button or Escape; reduced motion bypasses it. Asset failures
and a watchdog always restore access to the page. The two intro assets are
publicly accessible through middleware.
