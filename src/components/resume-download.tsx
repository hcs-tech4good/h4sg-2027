"use client";

import { useState } from "react";
import { getResumeSignedUrls, listResumesForDownload } from "@/lib/actions/auth";
import { assembleResumeZip, RESUME_SCOPES, type ResumeScope } from "@/lib/resume-zip";
import { Button } from "@/components/ui/button";

type Status = { kind: "info" | "success" | "warning" | "error"; text: string };

// Admin-only: downloads many resumes as one ZIP. The files are fetched and
// zipped in the browser, so nothing large passes through the server.
export function ResumeDownload() {
  const [scope, setScope] = useState<ResumeScope>("shared");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    setStatus({ kind: "info", text: "Finding resumes..." });
    try {
      const list = await listResumesForDownload(scope);
      if (!list.ok) {
        setStatus({ kind: "error", text: list.error });
        return;
      }
      const total = list.files.length;
      if (total === 0) {
        setStatus({ kind: "warning", text: "No resumes match that selection." });
        return;
      }
      if (
        !confirm(
          `Download ${total} resume${total === 1 ? "" : "s"} as one ZIP file?\n\n` +
            "This can take a few minutes. Keep this tab open until the download starts."
        )
      ) {
        setStatus(null);
        return;
      }

      const zip = await assembleResumeZip(list.files, {
        getUrls: async (ids) => {
          const res = await getResumeSignedUrls(ids);
          if (!res.ok) throw new Error(res.error);
          return res.urls;
        },
        fetchBytes: async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return new Uint8Array(await res.arrayBuffer());
        },
        onProgress: (done, all) => setStatus({ kind: "info", text: `Downloading resumes: ${done} of ${all}` }),
      });

      if (zip.included === 0) {
        setStatus({ kind: "error", text: "None of the resumes could be downloaded. Refresh and try again." });
        return;
      }

      const blob = new Blob(zip.parts as BlobPart[], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `h4sg-2027-resumes-${scope}-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      setStatus(
        zip.missing.length > 0
          ? {
              kind: "warning",
              text: `Downloaded ${zip.included} of ${total} resumes. ${zip.missing.length} could not be fetched; they are listed in missing.txt inside the ZIP.`,
            }
          : { kind: "success", text: `Downloaded ${zip.included} resumes. The ZIP also contains index.csv.` }
      );
    } catch {
      setStatus({ kind: "error", text: "The download failed. Refresh the page and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="resume-scope" className="text-sm font-medium">
          Download resumes
        </label>
        <select
          id="resume-scope"
          value={scope}
          onChange={(e) => setScope(e.target.value as ResumeScope)}
          disabled={busy}
          className="h-9 max-w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
        >
          {RESUME_SCOPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={handleDownload} disabled={busy}>
          {busy ? "Working..." : "Download ZIP"}
        </Button>
      </div>
      {status && (
        <p
          role="status"
          className={`text-sm ${
            status.kind === "success"
              ? "text-green-700"
              : status.kind === "warning"
                ? "text-yellow-800"
                : status.kind === "error"
                  ? "text-red-700"
                  : "text-gray-600"
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
