"use client";

import { H4SG_FIELDS, type H4sgDetails } from "@/lib/h4sg-application";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { changeReleasedDecision, makeDecision, exportSubmittedApplicationsCsv } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ApplicationRow {
  id: string;
  email: string;
  age: number | null;
  school: string | null;
  major: string | null;
  submitted_at: string | null;
  h4sg_details: H4sgDetails;
  underrepresented: string | null;
  harvard_affiliated: boolean | null;
  decisions: { type: string; released: boolean } | null;
  profiles: { first_name: string; last_name: string; hhid: string };
}

interface ApplicationsTableProps {
  applications: ApplicationRow[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export function ApplicationsTable({
  applications,
  totalCount,
  currentPage,
  pageSize,
}: ApplicationsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [bulkAction, setBulkAction] = useState("");
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const totalPages = Math.ceil(totalCount / pageSize);

  async function handleExportAll() {
    setExporting(true);
    try {
      const csv = await exportSubmittedApplicationsCsv();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("The export failed, so no file was downloaded. Please try again.");
    }
    setExporting(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    params.set("page", "1");
    router.push(`/applications?${params.toString()}`);
  }

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === applications.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(applications.map((a) => a.id)));
    }
  }

  async function handleBulkDecision() {
    if (!bulkAction || selected.size === 0) return;
    const type = bulkAction as "accepted" | "waitlisted" | "rejected";

    const chosen = applications.filter((a) => selected.has(a.id));
    const released = chosen.filter((a) => a.decisions?.released);
    const toChange = released.filter((a) => a.decisions!.type !== type);
    const toStage = chosen.filter((a) => !a.decisions?.released);
    const unchanged = released.length - toChange.length;

    if (toChange.length === 0 && toStage.length === 0) {
      alert(`All selected applicants are already ${type}. Nothing to change.`);
      return;
    }

    const lines = [`Apply "${type}" to ${chosen.length} applicant(s)?`, ""];
    if (toStage.length > 0) lines.push(`${toStage.length} will be staged (not visible to them until released).`);
    if (toChange.length > 0) {
      lines.push(
        `${toChange.length} already have a released result. They will see the change right away and be emailed an update.`
      );
    }
    if (unchanged > 0) lines.push(`${unchanged} are already ${type} and will be left alone.`);
    if (!confirm(lines.join("\n"))) return;

    setProcessing(true);
    let staged = 0;
    let changed = 0;
    let emailed = 0;
    let failed = 0;
    let emailError: string | undefined;
    try {
      for (const a of toStage) {
        const res = await makeDecision(a.id, type);
        if (res.success) staged++;
        else failed++;
      }
      for (const a of toChange) {
        const res = await changeReleasedDecision(a.id, type);
        if (!res.ok) failed++;
        else if (res.changed) {
          changed++;
          emailed += res.emailed;
          emailError ??= res.emailError;
        }
      }
    } catch {
      alert("Something went wrong partway through. Some decisions may not have been applied.");
    }

    const summary: string[] = [];
    if (staged > 0) summary.push(`${staged} staged.`);
    if (changed > 0) summary.push(`${changed} released decision(s) changed, ${emailed} email(s) sent.`);
    if (failed > 0) summary.push(`${failed} couldn't be saved. Refresh and try those again.`);
    if (emailError) {
      summary.push(`Email problem: ${emailError} Use "Send pending emails" on the Decisions page.`);
    } else if (changed > 0 && emailed < changed) {
      summary.push("Some update emails weren't confirmed as sent. Check the Decisions page.");
    }
    if (changed > 0 || failed > 0) alert(summary.join("\n"));

    setSelected(new Set());
    setBulkAction("");
    setProcessing(false);
    router.refresh();
  }

  function handleExportCSV() {
    const rows = applications.map((a) => ({
      name: `${a.profiles.first_name} ${a.profiles.last_name}`,
      email: a.email,
      hacker_id: a.profiles.hhid,
      school: a.school || "",
      major: a.major || "",
      age: a.age || "",
      decision: a.decisions?.type || "undecided",
      released: a.decisions?.released ? "yes" : "no",
      ...Object.fromEntries(H4SG_FIELDS.map((field) => [`h4sg_${field.key}`, a.h4sg_details?.[field.key] ?? ""])),
    }));

    function escapeCsv(val: unknown): string {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }

    const headers = Object.keys(rows[0] || {}).join(",");
    const csv = [
      headers,
      ...rows.map((r) => Object.values(r).map(escapeCsv).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "applications.csv";
    a.click();
  }

  function getDecisionBadge(decision: { type: string; released: boolean } | null) {
    if (!decision) return <Badge variant="secondary">Undecided</Badge>;
    const colors: Record<string, string> = {
      accepted: "bg-green-100 text-green-800",
      waitlisted: "bg-yellow-100 text-yellow-800",
      rejected: "bg-red-100 text-red-800",
    };
    return (
      <Badge className={colors[decision.type]}>
        {decision.type}{!decision.released && " (staged)"}
      </Badge>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search by email, school, major..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <Button type="submit" variant="outline">Search</Button>
        </form>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            Export Page
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportAll} disabled={exporting}>
            {exporting ? "Exporting..." : "Export All"}
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-teal-50 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select value={bulkAction} onValueChange={(v) => setBulkAction(v || "")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Bulk action..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="accepted">Accept</SelectItem>
              <SelectItem value="waitlisted">Waitlist</SelectItem>
              <SelectItem value="rejected">Reject</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleBulkDecision}
            disabled={!bulkAction || processing}
          >
            {processing ? "Processing..." : "Apply"}
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selected.size === applications.length && applications.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(app.id)}
                    onCheckedChange={() => toggleSelect(app.id)}
                  />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/applications/${app.id}`}
                    className="font-medium text-teal-600 hover:underline"
                  >
                    {app.profiles.first_name} {app.profiles.last_name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-gray-600">{app.email}</TableCell>
                <TableCell className="text-sm text-gray-600">{app.school || "—"}</TableCell>
                <TableCell>{getDecisionBadge(app.decisions)}</TableCell>
                <TableCell className="text-sm text-gray-500">
                  {app.submitted_at
                    ? new Date(app.submitted_at).toLocaleDateString()
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
            {applications.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No applications found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("page", String(currentPage - 1));
                router.push(`/applications?${params.toString()}`);
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("page", String(currentPage + 1));
                router.push(`/applications?${params.toString()}`);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
