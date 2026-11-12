import {
  buildAnnouncementEmail,
  buildDecisionUpdateEmail,
  type BuiltEmail,
} from "@/lib/email-templates";

export { buildAnnouncementEmail, buildDecisionUpdateEmail };

const POSTMARK_URL = "https://api.postmarkapp.com";
const DEFAULT_FROM = "Hack 4 Social Good <operations@t4sg.dev>";

// Postmark per-message error codes that mean this recipient can never be
// emailed (invalid address / bounced or suppressed). Anything else is treated
// as retryable so a configuration problem never marks people as failed.
const PERMANENT_RECIPIENT_ERRORS = new Set([300, 406]);

export interface Recipient {
  id: string;
  email: string | null;
  firstName: string | null;
}

export interface SendResult {
  sent: string[];
  // Permanent failures (bad address, suppressed): don't retry automatically.
  failed: { id: string; error: string }[];
  // Transient/config failures (rate limit, outage, bad token): safe to retry later.
  retry: string[];
  error?: string;
}

export function emailConfigured() {
  return Boolean(process.env.POSTMARK_API_TOKEN);
}

type Build = (r: Recipient) => BuiltEmail;

function toMessage(r: Recipient & { email: string }, build: Build) {
  const { subject, text, html } = build(r);
  return {
    From: process.env.EMAIL_FROM || DEFAULT_FROM,
    To: r.email,
    Subject: subject,
    TextBody: text,
    HtmlBody: html,
    MessageStream: "outbound",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postBatch(messages: unknown[]) {
  const send = () =>
    fetch(`${POSTMARK_URL}/email/batch`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": process.env.POSTMARK_API_TOKEN!,
      },
      body: JSON.stringify(messages),
    });
  let res = await send();
  if (res.status === 429) {
    await sleep(1200);
    res = await send();
  }
  return res;
}

async function errorMessage(res: Response) {
  try {
    const body = await res.json();
    return `${res.status}: ${body?.Message || "request failed"}`;
  } catch {
    return `${res.status}: request failed`;
  }
}

export function sendDecisionUpdateEmails(recipients: Recipient[]): Promise<SendResult> {
  return sendBatch(recipients, (r) => buildDecisionUpdateEmail(r.firstName));
}

export function sendAnnouncementEmails(recipients: Recipient[], title: string): Promise<SendResult> {
  return sendBatch(recipients, (r) => buildAnnouncementEmail(r.firstName, title));
}

async function sendBatch(recipients: Recipient[], build: Build): Promise<SendResult> {
  const result: SendResult = { sent: [], failed: [], retry: [] };

  const sendable: (Recipient & { email: string })[] = [];
  for (const r of recipients) {
    const email = r.email?.trim();
    if (!email) result.failed.push({ id: r.id, error: "No email address on file" });
    else sendable.push({ ...r, email });
  }
  if (sendable.length === 0) return result;

  let res: Response;
  try {
    res = await postBatch(sendable.map((r) => toMessage(r, build)));
  } catch (e) {
    result.retry.push(...sendable.map((r) => r.id));
    result.error = e instanceof Error ? e.message : "Network error";
    return result;
  }

  // Whole-request failure (bad token, unapproved account/unverified sender,
  // rate limit, outage). Nothing was sent, so everything stays retryable.
  if (!res.ok) {
    result.retry.push(...sendable.map((r) => r.id));
    result.error = await errorMessage(res);
    return result;
  }

  // Postmark answers 200 with one result per message, in request order.
  let items: { ErrorCode?: number; Message?: string }[] | null = null;
  try {
    const body = await res.json();
    if (Array.isArray(body) && body.length === sendable.length) items = body;
  } catch {
    items = null;
  }
  if (!items) {
    // Can't tell what was delivered. Leave them retryable rather than guess.
    result.retry.push(...sendable.map((r) => r.id));
    result.error = "Unexpected response from Postmark";
    return result;
  }

  sendable.forEach((r, i) => {
    const item = items![i];
    if (item.ErrorCode === 0) {
      result.sent.push(r.id);
    } else if (item.ErrorCode !== undefined && PERMANENT_RECIPIENT_ERRORS.has(item.ErrorCode)) {
      result.failed.push({ id: r.id, error: `${item.ErrorCode}: ${item.Message || "rejected"}` });
    } else {
      result.retry.push(r.id);
      result.error ??= `${item.ErrorCode}: ${item.Message || "send failed"}`;
    }
  });

  return result;
}
