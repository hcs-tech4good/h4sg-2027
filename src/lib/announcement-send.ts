import { sendAnnouncementEmailBatch, type NotifyResult } from "@/lib/actions/auth";

export interface AnnouncementSendTotals {
  sent: number;
  failed: number;
  remaining: number;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Sends an announcement's queued emails in bounded batches until none are
// left, an error occurs, or no progress is made (so it can never spin forever).
export async function sendAllAnnouncementEmails(
  announcementId: string,
  opts: { retryFailed?: boolean; onProgress?: (t: AnnouncementSendTotals) => void } = {}
): Promise<AnnouncementSendTotals> {
  const totals: AnnouncementSendTotals = { sent: 0, failed: 0, remaining: 0 };

  for (let first = true; ; first = false) {
    let res: NotifyResult;
    try {
      res = await sendAnnouncementEmailBatch(
        announcementId,
        first && opts.retryFailed ? { retryFailed: true } : undefined
      );
    } catch {
      totals.error = "Couldn't reach the server (or your session expired). Refresh and try again.";
      break;
    }
    totals.sent += res.sent;
    totals.failed += res.failed;
    totals.remaining = res.remaining;
    opts.onProgress?.({ ...totals });
    if (res.error) {
      totals.error = res.error;
      break;
    }
    if (res.remaining === 0 || res.sent + res.failed === 0) break;
    await sleep(500);
  }

  return totals;
}

export function announcementSendSummary(t: AnnouncementSendTotals) {
  const parts = [`${t.sent} email${t.sent === 1 ? "" : "s"} sent`];
  if (t.failed > 0) parts.push(`${t.failed} failed`);
  if (t.remaining > 0) parts.push(`${t.remaining} still pending`);
  return parts.join(", ") + ".";
}
