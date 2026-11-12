// Imports Claude API credit codes from a CSV export of signup codes
// (code, status, signup_link, ..., used_at, used_by_email) into the
// claude_credit_codes pool. Only active, unused codes are imported. Codes
// already in the pool are left untouched, so re-running is safe.
//
// Usage:
//   node scripts/import-credit-codes.mjs path/to/signup-codes.csv --dry-run
//   node scripts/import-credit-codes.mjs path/to/signup-codes.csv
//
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. The CSV holds redeemable codes: keep it out of
// the repo (*.csv is git-ignored).

// supabase-js builds a realtime client that needs a WebSocket on Node 20.
globalThis.WebSocket ??= class {
  constructor() {}
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
};

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CODE_RE = /^[0-9a-f]{32}$/;

function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"' && field === "") inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// The link must be a Claude Platform URL whose signup_code is this code.
function validLink(link, code) {
  try {
    const url = new URL(link);
    return url.protocol === "https:" && url.hostname === "platform.claude.com" &&
      url.searchParams.get("signup_code") === code;
  } catch {
    return false;
  }
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvArg = args.find((a) => !a.startsWith("--"));
  if (!csvArg) {
    console.error("Usage: node scripts/import-credit-codes.mjs path/to/signup-codes.csv [--dry-run]");
    process.exit(1);
  }
  const csvPath = path.resolve(csvArg);
  if (!existsSync(csvPath)) { console.error(`CSV not found: ${csvPath}`); process.exit(1); }

  const rows = parseCsv(readFileSync(csvPath, "utf8").replace(/^﻿/, ""));
  const header = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  const col = (name) => header.indexOf(name);
  const [iCode, iStatus, iLink, iUsedAt, iUsedBy] =
    ["code", "status", "signup_link", "used_at", "used_by_email"].map(col);
  if (iCode < 0 || iLink < 0) {
    console.error(`CSV header must include "code" and "signup_link". Found: ${header.join(", ")}`);
    process.exit(1);
  }

  const seen = new Set();
  const toWrite = [];
  const skipped = [];
  for (const r of rows) {
    const code = (r[iCode] || "").trim().toLowerCase();
    const link = (r[iLink] || "").trim();
    if (!CODE_RE.test(code)) { skipped.push(`malformed code: ${code || "(blank)"}`); continue; }
    if (iStatus >= 0 && (r[iStatus] || "").trim().toLowerCase() !== "active") { skipped.push(`not active: ${code}`); continue; }
    if ((iUsedAt >= 0 && r[iUsedAt]?.trim()) || (iUsedBy >= 0 && r[iUsedBy]?.trim())) { skipped.push(`already used: ${code}`); continue; }
    if (!validLink(link, code)) { skipped.push(`bad signup link: ${code}`); continue; }
    if (seen.has(code)) { skipped.push(`duplicate in CSV: ${code}`); continue; }
    seen.add(code);
    toWrite.push({ code, signup_link: link });
  }

  console.log(`${rows.length} CSV rows | ${toWrite.length} importable | ${skipped.length} skipped`);
  for (const s of skipped) console.log(`  skipped: ${s}`);

  if (dryRun) { console.log("\nDry run: nothing written."); return; }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let added = 0;
  for (let i = 0; i < toWrite.length; i += 200) {
    const { data, error } = await supabase
      .from("claude_credit_codes")
      .upsert(toWrite.slice(i, i + 200), { onConflict: "code", ignoreDuplicates: true })
      .select("code");
    if (error) { console.error(`Write failed: ${error.message}`); process.exit(1); }
    added += data.length;
  }
  const { count } = await supabase
    .from("claude_credit_codes")
    .select("code", { count: "exact", head: true })
    .is("assigned_at", null);
  console.log(`\nAdded ${added} new code(s). ${count ?? "?"} unclaimed in the pool.`);
}

main();
