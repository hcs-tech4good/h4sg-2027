// Pure email builders with no secrets or server-only imports, so the admin
// preview in the browser renders exactly what the server sends.

const DEFAULT_SITE_URL = "http://localhost:3000";
const MAX_SUBJECT_TITLE = 150;

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

export function portalUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

// Served from this project's own /public folder rather than an external repo,
// so it can't silently break if that repo is renamed, made private, or deleted.
function logoUrl() {
  return `${portalUrl()}/email-logo.png`;
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// `bodyHtml` and `noteHtml` are trusted markup: callers must escape any
// user-provided text before passing it in.
function layout(opts: {
  name: string;
  bodyHtml: string;
  buttonLabel: string;
  url: string;
  noteHtml: string;
}) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8f8f8;font-family:'Open Sans',Helvetica,Arial,sans-serif;color:#000000;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
      <img src="${logoUrl()}" alt="Hack 4 Social Good" width="82" height="96" style="display:block;margin:0 auto 24px;border:0;outline:none;border-radius:16px;max-width:100%;">
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(opts.name)},</p>
      ${opts.bodyHtml}
      <p style="margin:24px 0;text-align:center;">
        <a href="${escapeHtml(opts.url)}" style="display:inline-block;background:#078a5c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;">${escapeHtml(opts.buttonLabel)}</a>
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#797e82;">${opts.noteHtml}</p>
      <p style="margin:0;font-size:14px;color:#797e82;">The Hack 4 Social Good Team</p>
    </div>
    <p style="max-width:520px;margin:16px auto 0;text-align:center;font-size:12px;color:#797e82;">
      <a href="${escapeHtml(portalUrl())}/" style="color:#078a5c;">Main</a> &nbsp;|&nbsp; <a href="${escapeHtml(portalUrl())}/dashboard" style="color:#078a5c;">Portal</a><br>Hack 4 Social Good &copy; 2027
    </p>
  </body>
</html>`;
}

// Intentionally identical for every decision type: it never reveals the
// outcome, it just sends people to the portal to look.
export function buildDecisionUpdateEmail(firstName: string | null): BuiltEmail {
  const name = firstName?.trim() || "there";
  const url = `${portalUrl()}/dashboard`;
  const subject = "Hack 4 Social Good 2027 Admissions Update";

  const text = [
    `Hi ${name},`,
    "",
    "There's an update on your Hack 4 Social Good 2027 application.",
    `Log in to the portal to view it: ${url}`,
    "",
    "Please check your status from the portal rather than replying to this email.",
    "",
    "The Hack 4 Social Good Team",
  ].join("\n");

  const html = layout({
    name,
    bodyHtml: `<p style="margin:0 0 16px;font-size:16px;">There's an update on your Hack 4 Social Good 2027 application.</p>`,
    buttonLabel: "View Your Application Status",
    url,
    noteHtml: "Please check your status from the portal rather than replying to this email.",
  });

  return { subject, text, html };
}

// Collapses line breaks and runs of whitespace so a title can never inject
// extra header lines into the subject, and caps its length.
function singleLine(s: string) {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > MAX_SUBJECT_TITLE ? `${flat.slice(0, MAX_SUBJECT_TITLE - 1)}…` : flat;
}

// Tells accepted hackers a new announcement exists and links to it. The
// announcement body itself stays in the portal.
export function buildAnnouncementEmail(firstName: string | null, title: string): BuiltEmail {
  const name = firstName?.trim() || "there";
  const url = `${portalUrl()}/announcements`;
  const cleanTitle = singleLine(title) || "New announcement";
  const subject = `Hack 4 Social Good 2027 Announcement: ${cleanTitle}`;

  const text = [
    `Hi ${name},`,
    "",
    "The Hack 4 Social Good team posted a new announcement:",
    cleanTitle,
    "",
    `Read it in the portal: ${url}`,
    "",
    "You're receiving this because you were accepted to Hack 4 Social Good 2027.",
    "",
    "The Hack 4 Social Good Team",
  ].join("\n");

  const html = layout({
    name,
    bodyHtml:
      `<p style="margin:0 0 16px;font-size:16px;">The Hack 4 Social Good team posted a new announcement:</p>` +
      `<p style="margin:0 0 16px;font-size:18px;font-weight:bold;word-break:break-word;">${escapeHtml(cleanTitle)}</p>`,
    buttonLabel: "View Announcement",
    url,
    noteHtml: "You're receiving this because you were accepted to Hack 4 Social Good 2027.",
  });

  return { subject, text, html };
}
