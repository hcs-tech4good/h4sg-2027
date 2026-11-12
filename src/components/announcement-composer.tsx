"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAnnouncement } from "@/lib/actions/auth";
import { buildAnnouncementEmail } from "@/lib/email-templates";
import {
  announcementSendSummary,
  sendAllAnnouncementEmails,
  type AnnouncementSendTotals,
} from "@/lib/announcement-send";
import { ANNOUNCEMENT_CONTENT_MAX, ANNOUNCEMENT_TITLE_MAX } from "@/lib/announcement-limits";
import { AnnouncementCard } from "@/components/announcement-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AnnouncementComposerProps {
  recipientCount: number;
  emailConfigured: boolean;
  previewName: string;
}

type Result = { kind: "success" | "warning" | "error"; text: string };

export function AnnouncementComposer({ recipientCount, emailConfigured, previewName }: AnnouncementComposerProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"editing" | "posting" | "emailing" | "done">("editing");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [postedId, setPostedId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  const busy = phase === "posting" || phase === "emailing";
  const locked = phase !== "editing";
  const cleanTitle = title.trim();
  const cleanContent = content.trim();
  const email = buildAnnouncementEmail(previewName, cleanTitle || "Your title");

  function report(prefix: string, totals: AnnouncementSendTotals) {
    setRemaining(totals.remaining);
    const text = [prefix, announcementSendSummary(totals), totals.error].filter(Boolean).join(" ");
    setResult({
      kind: totals.error || totals.failed > 0 || totals.remaining > 0 ? "warning" : "success",
      text:
        totals.error || totals.remaining > 0
          ? `${text} The announcement is live; use "Send remaining emails" to finish.`
          : text,
    });
  }

  async function sendEmails(id: string, prefix: string) {
    setPhase("emailing");
    setProgress("Emailing accepted hackers...");
    const totals = await sendAllAnnouncementEmails(id, {
      onProgress: (t) => setProgress(`Emailing accepted hackers: ${t.sent} sent, ${t.remaining} remaining`),
    });
    report(prefix, totals);
    setProgress("");
    setPhase("done");
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setError("");
    if (!cleanTitle) return setError("Please enter a title.");
    if (!cleanContent) return setError("Please enter the announcement content.");

    const ok = confirm(
      `Post this announcement?\n\n` +
        `It will be visible to accepted hackers and staff right away, and ${recipientCount} accepted hacker${
          recipientCount === 1 ? "" : "s"
        } will be emailed that a new announcement exists. This cannot be undone.`
    );
    if (!ok) return;

    setPhase("posting");
    setProgress("Posting announcement...");
    try {
      const res = await createAnnouncement({ title: cleanTitle, content: cleanContent });
      if (!res.ok) {
        setError(res.error);
        setPhase("editing");
        setProgress("");
        return;
      }
      setPostedId(res.id);
      if (res.queueError) {
        setResult({ kind: "warning", text: res.queueError });
        setProgress("");
        setPhase("done");
        return;
      }
      if (res.queued === 0) {
        setResult({ kind: "success", text: "Announcement posted. There are no accepted hackers to email yet." });
        setProgress("");
        setPhase("done");
        return;
      }
      await sendEmails(res.id, "Announcement posted.");
    } catch {
      setError("Something went wrong. Check the Announcements page before trying again, so you don't post twice.");
      setPhase("editing");
      setProgress("");
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Announcement</h1>
        <p className="text-gray-500 mt-1">
          Visible only to accepted hackers and staff. {recipientCount} accepted hacker
          {recipientCount === 1 ? "" : "s"} will be emailed that it exists.
        </p>
      </div>

      {!emailConfigured && (
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-900">
          Email sending isn&apos;t configured (set <code>POSTMARK_API_TOKEN</code>). You can still post, but nobody
          will be emailed.
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Announcement Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePublish} className="space-y-4">
              {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="announcement-title">Title</Label>
                  <span className="text-xs text-gray-400">
                    {title.length}/{ANNOUNCEMENT_TITLE_MAX}
                  </span>
                </div>
                <Input
                  id="announcement-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={ANNOUNCEMENT_TITLE_MAX}
                  disabled={locked}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="announcement-content">Content</Label>
                  <span className="text-xs text-gray-400">
                    {content.length}/{ANNOUNCEMENT_CONTENT_MAX}
                  </span>
                </div>
                <Textarea
                  id="announcement-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  maxLength={ANNOUNCEMENT_CONTENT_MAX}
                  disabled={locked}
                />
                <p className="text-xs text-gray-400">
                  Plain text. Line breaks are kept, and links starting with http:// or https:// become clickable.
                </p>
              </div>

              {progress && (
                <div role="status" className="rounded-md bg-teal-50 p-3 text-sm text-teal-900">
                  {progress} Keep this page open until it finishes.
                </div>
              )}
              {result && (
                <div
                  role="status"
                  className={`rounded-md p-3 text-sm ${
                    result.kind === "success"
                      ? "bg-green-50 text-green-900"
                      : result.kind === "warning"
                        ? "bg-yellow-50 text-yellow-900"
                        : "bg-red-50 text-red-900"
                  }`}
                >
                  {result.text}
                </div>
              )}

              {phase === "done" ? (
                <div className="flex flex-wrap gap-2">
                  {postedId && remaining > 0 && (
                    <Button type="button" onClick={() => sendEmails(postedId, "")}>
                      Send remaining emails
                    </Button>
                  )}
                  <Link
                    href="/announcements"
                    className="inline-flex h-9 items-center rounded-md border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50"
                  >
                    View announcements
                  </Link>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy}>
                    {phase === "posting" ? "Posting..." : phase === "emailing" ? "Emailing..." : "Publish Announcement"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-gray-500">Preview: Announcements tab</h2>
            <AnnouncementCard
              title={cleanTitle || "Your title"}
              content={cleanContent || "Your announcement will appear here as you type."}
              createdAt={null}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium text-gray-500">Preview: email to accepted hackers</h2>
            <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
              <p className="border-b px-3 py-2 text-sm break-words">
                <span className="text-gray-400">Subject: </span>
                {email.subject}
              </p>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={email.html}
                className="h-[560px] w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
