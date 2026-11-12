import { buildZip, type ZipEntry } from "@/lib/zip";

export type ResumeScope = "shared" | "accepted" | "all";

export const RESUME_SCOPES: { value: ResumeScope; label: string }[] = [
  { value: "shared", label: "Resume book: accepted, agreed to share with sponsors" },
  { value: "accepted", label: "All accepted hackers" },
  { value: "all", label: "All submitted applications" },
];

export interface ResumeFile {
  id: string;
  hhid: string;
  firstName: string;
  lastName: string;
  email: string;
  school: string;
  major: string;
  graduationYear: number | null;
  decision: string;
  resumeShare: boolean;
}

// How many signed links to request at a time. Links expire after a few
// minutes, so each batch is downloaded before the next is requested.
export const RESUME_URL_BATCH = 50;
const DOWNLOAD_CONCURRENCY = 6;

function safePart(s: string) {
  const cleaned = s
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}-]+/gu, "_")
    .replace(/^[_-]+|[_-]+$/g, "");
  // Cut by whole characters so a multi-unit character is never split.
  return Array.from(cleaned).slice(0, 60).join("");
}

// "Last_First_H-1234567.pdf", with anything unsafe for a file name removed.
export function resumeFileName(f: Pick<ResumeFile, "firstName" | "lastName" | "hhid" | "id">) {
  const parts = [safePart(f.lastName), safePart(f.firstName), safePart(f.hhid) || f.id.slice(0, 8)];
  return `${parts.filter(Boolean).join("_")}.pdf`;
}

// Quotes a CSV cell, and neutralises a leading =, +, -, @, tab or CR so a
// spreadsheet never runs applicant-typed text as a formula.
function csvCell(val: unknown) {
  let s = val === null || val === undefined ? "" : String(val);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildIndexCsv(rows: { file: ResumeFile; name: string | null }[]) {
  const header = [
    "hacker_id", "first_name", "last_name", "email", "school", "major",
    "graduation_year", "decision", "agreed_to_share_with_sponsors", "resume_file",
  ];
  const lines = rows.map(({ file: f, name }) =>
    [
      f.hhid, f.firstName, f.lastName, f.email, f.school, f.major,
      f.graduationYear ?? "", f.decision, f.resumeShare ? "yes" : "no", name ?? "MISSING",
    ]
      .map(csvCell)
      .join(",")
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}

export interface AssembleDeps {
  getUrls: (ids: string[]) => Promise<Record<string, string | null>>;
  fetchBytes: (url: string) => Promise<Uint8Array>;
  onProgress?: (done: number, total: number) => void;
}

export interface AssembledZip {
  parts: Uint8Array[];
  included: number;
  missing: ResumeFile[];
}

// Downloads every resume and builds the archive: the PDFs, an index.csv
// listing everyone, and a missing.txt when some files couldn't be fetched.
// One failed file never aborts the whole download.
export async function assembleResumeZip(files: ResumeFile[], deps: AssembleDeps): Promise<AssembledZip> {
  const entries: ZipEntry[] = [];
  const nameById = new Map<string, string>();
  const missing: ResumeFile[] = [];
  // Lower-cased, because unzipping on macOS or Windows treats names that
  // differ only by case as the same file.
  const used = new Set<string>(["index.csv", "missing.txt"]);
  let done = 0;

  for (let i = 0; i < files.length; i += RESUME_URL_BATCH) {
    const batch = files.slice(i, i + RESUME_URL_BATCH);
    let urls: Record<string, string | null> = {};
    try {
      urls = await deps.getUrls(batch.map((f) => f.id));
    } catch {
      urls = {};
    }

    const results = new Map<string, Uint8Array | null>();
    let next = 0;
    const worker = async () => {
      while (next < batch.length) {
        const f = batch[next++];
        const url = urls[f.id];
        let bytes: Uint8Array | null = null;
        if (url) {
          try {
            bytes = await deps.fetchBytes(url);
            if (bytes.length === 0) bytes = null;
          } catch {
            bytes = null;
          }
        }
        results.set(f.id, bytes);
        done++;
        deps.onProgress?.(done, files.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, batch.length) }, worker));

    // Add in list order so the archive is stable regardless of download timing.
    for (const f of batch) {
      const bytes = results.get(f.id);
      if (!bytes) {
        missing.push(f);
        continue;
      }
      let name = resumeFileName(f);
      for (let n = 2; used.has(name.toLowerCase()); n++) {
        name = resumeFileName(f).replace(/\.pdf$/, `_${n}.pdf`);
      }
      used.add(name.toLowerCase());
      nameById.set(f.id, name);
      entries.push({ name, data: bytes });
    }
  }

  const encoder = new TextEncoder();
  const index = buildIndexCsv(files.map((file) => ({ file, name: nameById.get(file.id) ?? null })));
  entries.push({ name: "index.csv", data: encoder.encode(`﻿${index}`) });
  if (missing.length > 0) {
    const lines = missing.map((f) => `${f.hhid}\t${f.firstName} ${f.lastName}\t${f.email}`);
    entries.push({
      name: "missing.txt",
      data: encoder.encode(
        `These ${missing.length} resume(s) could not be downloaded and are not in this archive:\n\n${lines.join("\n")}\n`
      ),
    });
  }

  return { parts: buildZip(entries), included: nameById.size, missing };
}
