"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  changeReleasedDecisions,
  releaseDecisions,
  sendPendingNotifications,
  type NotifyResult,
} from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DecisionRelease } from "@/types/database";

interface StagedDecision {
  id: string;
  type: string;
  decided_at: string;
  profiles: { first_name: string; last_name: string; hhid: string };
  applications: { email: string };
}

interface EmailStatus {
  configured: boolean;
  pending: number;
  failed: number;
}

interface DecisionsManagerProps {
  stagedDecisions: StagedDecision[];
  releasedDecisions: StagedDecision[];
  recentReleases: DecisionRelease[];
  emailStatus: EmailStatus;
}

type DecisionType = "accepted" | "waitlisted" | "rejected";

type Notice = { kind: "success" | "warning" | "error"; text: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DecisionsManager({
  stagedDecisions,
  releasedDecisions,
  recentReleases,
  emailStatus,
}: DecisionsManagerProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"idle" | "releasing" | "emailing">("idle");
  const [progress, setProgress] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"staged" | "released">("staged");
  const [changeTo, setChangeTo] = useState<DecisionType | "">("");
  const busy = phase !== "idle";
  const base = view === "staged" ? stagedDecisions : releasedDecisions;

  function switchView(next: "staged" | "released") {
    if (next === view || busy) return;
    setView(next);
    setSelected(new Set());
    setChangeTo("");
  }

  const q = query.trim().toLowerCase();
  const matches = (d: StagedDecision) =>
    !q ||
    `${d.profiles.first_name} ${d.profiles.last_name}`.toLowerCase().includes(q) ||
    d.applications.email.toLowerCase().includes(q) ||
    d.profiles.hhid.toLowerCase().includes(q);
  const visible = q ? base.filter(matches) : base;

  const accepted = visible.filter((d) => d.type === "accepted");
  const waitlisted = visible.filter((d) => d.type === "waitlisted");
  const rejected = visible.filter((d) => d.type === "rejected");

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectAll(decisions: StagedDecision[]) {
    const ids = decisions.map((d) => d.id);
    const allSelected = ids.every((id) => selected.has(id));
    const next = new Set(selected);
    if (allSelected) {
      ids.forEach((id) => next.delete(id));
    } else {
      ids.forEach((id) => next.add(id));
    }
    setSelected(next);
  }

  // Emails released applicants in bounded batches until none are left, an
  // error occurs, or no progress is made (so it can never spin forever).
  async function sendEmails(retryFailed = false) {
    setPhase("emailing");
    let sent = 0;
    let failed = 0;
    let remaining = 0;
    let error: string | undefined;

    for (let first = true; ; first = false) {
      let res: NotifyResult;
      try {
        res = await sendPendingNotifications(first ? { retryFailed } : undefined);
      } catch {
        error = "Couldn't reach the server (or your session expired). Refresh and try again.";
        break;
      }
      sent += res.sent;
      failed += res.failed;
      remaining = res.remaining;
      setProgress(`Emailing applicants: ${sent} sent, ${remaining} remaining`);
      if (res.error) {
        error = res.error;
        break;
      }
      if (remaining === 0 || res.sent + res.failed === 0) break;
      await sleep(500);
    }

    return { sent, failed, remaining, error };
  }

  function emailSummary(r: { sent: number; failed: number; remaining: number; error?: string }) {
    const parts = [`${r.sent} email${r.sent === 1 ? "" : "s"} sent`];
    if (r.failed > 0) parts.push(`${r.failed} failed`);
    if (r.remaining > 0) parts.push(`${r.remaining} still pending`);
    return parts.join(", ") + ".";
  }

  async function handleRelease() {
    if (selected.size === 0 || busy) return;

    const chosen = stagedDecisions.filter((d) => selected.has(d.id));
    const count = (t: string) => chosen.filter((d) => d.type === t).length;
    const ok = confirm(
      `Release ${chosen.length} decisions (${count("accepted")} accepted, ${count("waitlisted")} waitlisted, ${count("rejected")} rejected)?\n\n` +
        "Applicants will see their result right away and be emailed. This cannot be undone."
    );
    if (!ok) return;

    setNotice(null);
    setPhase("releasing");
    setProgress("Releasing decisions...");
    try {
      const res = await releaseDecisions(chosen.map((d) => d.id));
      if (!res.ok) {
        setNotice({ kind: "error", text: res.error });
        return;
      }
      setSelected(new Set());

      const email = await sendEmails();
      const released = `Released ${res.released} decision${res.released === 1 ? "" : "s"}${
        res.skipped > 0 ? ` (${res.skipped} skipped: already released)` : ""
      }.`;
      if (email.error) {
        setNotice({
          kind: "warning",
          text: `${released} ${emailSummary(email)} ${email.error} Applicants can already see their result in the portal; use "Send pending emails" to finish notifying them.`,
        });
      } else {
        setNotice({
          kind: email.failed > 0 || email.remaining > 0 ? "warning" : "success",
          text: `${released} ${emailSummary(email)}`,
        });
      }
    } catch {
      setNotice({
        kind: "error",
        text: "Something went wrong. Refresh to see the current state before trying again.",
      });
    } finally {
      setPhase("idle");
      setProgress("");
      router.refresh();
    }
  }

  async function handleChangeReleased() {
    if (selected.size === 0 || !changeTo || busy) return;
    const type = changeTo;

    const chosen = releasedDecisions.filter((d) => selected.has(d.id));
    const toChange = chosen.filter((d) => d.type !== type);
    if (toChange.length === 0) {
      setNotice({ kind: "warning", text: `Everyone selected is already ${type}. Nothing to change.` });
      return;
    }
    const count = (t: string) => toChange.filter((d) => d.type === t).length;
    const from = (["accepted", "waitlisted", "rejected"] as const)
      .filter((t) => count(t) > 0)
      .map((t) => `${count(t)} ${t}`)
      .join(", ");
    const ok = confirm(
      `Change ${toChange.length} released decision${toChange.length === 1 ? "" : "s"} to ${type}? (${from})\n\n` +
        "These applicants already have a released result. They will see the change right away and be emailed an update. This cannot be undone."
    );
    if (!ok) return;

    setNotice(null);
    setPhase("releasing");
    setProgress("Changing decisions...");
    try {
      const res = await changeReleasedDecisions(toChange.map((d) => d.id), type);
      if (!res.ok) {
        setNotice({ kind: "error", text: res.error });
        return;
      }
      setSelected(new Set());
      setChangeTo("");
      const changed = `Changed ${res.changed} decision${res.changed === 1 ? "" : "s"} to ${type}${
        res.skipped > 0 ? ` (${res.skipped} skipped: already ${type} or no longer released)` : ""
      }.`;
      if (res.changed === 0) {
        setNotice({ kind: "warning", text: changed });
        return;
      }

      const email = await sendEmails();
      if (email.error) {
        setNotice({
          kind: "warning",
          text: `${changed} ${emailSummary(email)} ${email.error} Applicants can already see their new result in the portal; use "Send pending emails" to finish notifying them.`,
        });
      } else {
        setNotice({
          kind: email.failed > 0 || email.remaining > 0 ? "warning" : "success",
          text: `${changed} ${emailSummary(email)}`,
        });
      }
    } catch {
      setNotice({
        kind: "error",
        text: "Something went wrong. Refresh to see the current state before trying again.",
      });
    } finally {
      setPhase("idle");
      setProgress("");
      router.refresh();
    }
  }

  async function handleSendPending(retryFailed: boolean) {
    if (busy) return;
    setNotice(null);
    setProgress("Emailing applicants...");
    try {
      const email = await sendEmails(retryFailed);
      setNotice({
        kind: email.error || email.failed > 0 || email.remaining > 0 ? "warning" : "success",
        text: [emailSummary(email), email.error].filter(Boolean).join(" "),
      });
    } finally {
      setPhase("idle");
      setProgress("");
      router.refresh();
    }
  }

  function handleExportEmails(type: string) {
    const decisions = base.filter((d) => d.type === type);
    const emails = decisions.map((d) => d.applications.email);
    const csv = "email\n" + emails.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${view}_${type}_emails.csv`;
    a.click();
  }

  function handleExportAllEmails() {
    const emails = base.map((d) => `${d.applications.email},${d.type}`);
    const csv = "email,decision\n" + emails.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `all_${view}_emails.csv`;
    a.click();
  }

  function renderDecisionTable(decisions: StagedDecision[]) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={decisions.length > 0 && decisions.every((d) => selected.has(d.id))}
                onCheckedChange={() => selectAll(decisions)}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Hacker ID</TableHead>
            <TableHead>Decided</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {decisions.map((d) => (
            <TableRow key={d.id}>
              <TableCell>
                <Checkbox
                  checked={selected.has(d.id)}
                  onCheckedChange={() => toggleSelect(d.id)}
                />
              </TableCell>
              <TableCell className="font-medium">
                <Link href={`/applications/${d.id}`} className="hover:underline text-teal-600">
                  {d.profiles.first_name} {d.profiles.last_name}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-gray-600">
                {d.applications.email}
              </TableCell>
              <TableCell className="font-mono text-sm">{d.profiles.hhid}</TableCell>
              <TableCell className="text-sm text-gray-500">
                {new Date(d.decided_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
          {decisions.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                {q ? `No matches for "${query.trim()}"` : view === "staged" ? "None staged" : "None released"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6">
      {/* Staged / Released switch */}
      <div className="inline-flex rounded-md border border-gray-200 p-1">
        {(["staged", "released"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => switchView(v)}
            disabled={busy}
            aria-pressed={view === v}
            className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
              view === v ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {v === "staged" ? "Staged" : "Released"} ({(v === "staged" ? stagedDecisions : releasedDecisions).length})
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Accepted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{accepted.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700">Waitlisted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{waitlisted.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rejected.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status / email banners */}
      {notice && (
        <div
          role="status"
          className={`rounded-md p-4 text-sm ${
            notice.kind === "success"
              ? "bg-green-50 text-green-900"
              : notice.kind === "warning"
                ? "bg-yellow-50 text-yellow-900"
                : "bg-red-50 text-red-900"
          }`}
        >
          {notice.text}
        </div>
      )}
      {busy && progress && (
        <div role="status" className="rounded-md bg-teal-50 p-4 text-sm text-teal-900">
          {progress} Keep this page open until it finishes.
        </div>
      )}
      {!emailStatus.configured && (
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-900">
          Email sending isn&apos;t configured (set <code>POSTMARK_API_TOKEN</code>). Releasing still works, but applicants won&apos;t be emailed
          {emailStatus.pending > 0 && ` (${emailStatus.pending} released decisions are waiting to be emailed)`}
          .
        </div>
      )}
      {emailStatus.configured && emailStatus.pending > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-teal-50 p-4 text-sm">
          <span>
            {emailStatus.pending} released decision{emailStatus.pending === 1 ? " hasn't" : "s haven't"} been
            emailed yet.
          </span>
          <Button size="sm" onClick={() => handleSendPending(false)} disabled={busy}>
            {phase === "emailing" ? "Sending..." : "Send pending emails"}
          </Button>
        </div>
      )}
      {emailStatus.failed > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-red-50 p-4 text-sm text-red-900">
          <span>
            {emailStatus.failed} email{emailStatus.failed === 1 ? "" : "s"} failed permanently (e.g. invalid
            address).
          </span>
          {emailStatus.configured && (
            <Button size="sm" variant="outline" onClick={() => handleSendPending(true)} disabled={busy}>
              Retry failed
            </Button>
          )}
        </div>
      )}

      {/* Change Bar (released view) */}
      {view === "released" && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-teal-50 p-4">
          <span className="text-sm font-medium">{selected.size} released decisions selected</span>
          <label htmlFor="change-to" className="text-sm">
            Change to
          </label>
          <select
            id="change-to"
            value={changeTo}
            onChange={(e) => setChangeTo(e.target.value as DecisionType | "")}
            disabled={busy}
            className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
          >
            <option value="">Select...</option>
            <option value="accepted">Accepted</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button onClick={handleChangeReleased} disabled={busy || !changeTo}>
            {phase === "releasing" ? "Changing..." : phase === "emailing" ? "Emailing..." : "Change and Email"}
          </Button>
          <p className="text-xs text-gray-500">
            They see the new result right away and get an email that their application was updated
          </p>
        </div>
      )}

      {/* Release Bar */}
      {view === "staged" && selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-teal-50 p-4">
          <span className="text-sm font-medium">{selected.size} decisions selected</span>
          <Button onClick={handleRelease} disabled={busy}>
            {phase === "releasing" ? "Releasing..." : phase === "emailing" ? "Emailing..." : "Release to Hackers"}
          </Button>
          <p className="text-xs text-gray-500 ml-2">
            Applicants see their result on their dashboard and get an email that their application was updated
          </p>
        </div>
      )}

      {/* Export Emails */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExportEmails("accepted")}>
          Export Accepted Emails
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExportEmails("waitlisted")}>
          Export Waitlisted Emails
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExportEmails("rejected")}>
          Export Rejected Emails
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportAllEmails}>
          Export All
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by name, email, or Hacker ID..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {/* Tabs by decision type */}
      <Tabs defaultValue="accepted">
        <TabsList>
          <TabsTrigger value="accepted">Accepted ({accepted.length})</TabsTrigger>
          <TabsTrigger value="waitlisted">Waitlisted ({waitlisted.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="accepted" className="rounded-md border mt-4">
          {renderDecisionTable(accepted)}
        </TabsContent>
        <TabsContent value="waitlisted" className="rounded-md border mt-4">
          {renderDecisionTable(waitlisted)}
        </TabsContent>
        <TabsContent value="rejected" className="rounded-md border mt-4">
          {renderDecisionTable(rejected)}
        </TabsContent>
      </Tabs>

      {/* Recent Releases */}
      {recentReleases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Releases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentReleases.map((release) => (
                <div key={release.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <span>
                    Released {release.decision_ids.length} decisions
                    {release.notes && ` — ${release.notes}`}
                  </span>
                  <Badge variant="secondary">
                    {new Date(release.released_at).toLocaleDateString()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
