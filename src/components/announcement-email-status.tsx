"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { announcementSendSummary, sendAllAnnouncementEmails } from "@/lib/announcement-send";

interface AnnouncementEmailStatusProps {
  announcementId: string;
  sent: number;
  pending: number;
  failed: number;
}

// Admin-only line under an announcement: how many emails went out, and a way
// to finish or retry a send that was interrupted.
export function AnnouncementEmailStatus({ announcementId, sent, pending, failed }: AnnouncementEmailStatusProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function send(retryFailed: boolean) {
    if (busy) return;
    setBusy(true);
    setMessage("Sending...");
    const totals = await sendAllAnnouncementEmails(announcementId, {
      retryFailed,
      onProgress: (t) => setMessage(`Sending: ${t.sent} sent, ${t.remaining} remaining`),
    });
    setMessage([announcementSendSummary(totals), totals.error].filter(Boolean).join(" "));
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-gray-500">
      <span>
        Staff only: emailed to {sent} accepted hacker{sent === 1 ? "" : "s"}
        {pending > 0 && `, ${pending} not sent yet`}
        {failed > 0 && `, ${failed} failed`}.
      </span>
      {pending > 0 && (
        <Button size="sm" variant="outline" onClick={() => send(false)} disabled={busy}>
          {busy ? "Sending..." : "Send remaining emails"}
        </Button>
      )}
      {failed > 0 && (
        <Button size="sm" variant="outline" onClick={() => send(true)} disabled={busy}>
          Retry failed
        </Button>
      )}
      {message && <span role="status">{message}</span>}
    </div>
  );
}
