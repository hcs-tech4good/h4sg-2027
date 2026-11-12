// One-off import: reads a CSV of (full_name, email, code) and upserts each
// code into the matching_codes table, keyed by the applicant's user id.
//
// Usage:
//   node scripts/import-matching-codes.mjs [path/to/file.csv]
// Defaults to Acceptance_Codes.csv in the project root if no path is given.
//
// Requires .env.local to have NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY set. The source CSV is never read by the app
// itself and must never be committed (see .gitignore).

// supabase-js eagerly constructs a realtime client, which throws on Node 20
// without a global WebSocket. We never use realtime here, so a no-op stub
// is enough to satisfy the constructor.
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

function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

// Minimal RFC4180 CSV parser: handles quoted fields, embedded commas, and
// escaped quotes ("") since applicant names can contain any of these.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
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

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const csvPath = path.resolve(process.argv[2] || path.join(projectRoot, "Acceptance_Codes.csv"));
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const header = rows.shift()?.map((h) => h.trim().toLowerCase());
  const col = (name) => header?.indexOf(name) ?? -1;
  const iName = col("full_name");
  const iEmail = col("email");
  const iCode = col("code");
  if (iEmail === -1 || iCode === -1) {
    console.error(`CSV header must include "email" and "code" columns. Found: ${header?.join(", ")}`);
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const seenEmails = new Map();
  const seenCodes = new Map();
  const unmatched = [];
  const duplicateInCsv = [];
  let matched = 0;
  let errors = 0;

  for (const r of rows) {
    const name = iName >= 0 ? r[iName]?.trim() : "";
    const email = r[iEmail]?.trim();
    const code = r[iCode]?.trim();
    if (!email || !code) continue;

    const emailKey = email.toLowerCase();
    if (seenEmails.has(emailKey)) { duplicateInCsv.push(`duplicate email in CSV: ${email}`); continue; }
    seenEmails.set(emailKey, true);
    if (seenCodes.has(code)) { duplicateInCsv.push(`duplicate code in CSV: ${code} (${email} and ${seenCodes.get(code)})`); continue; }
    seenCodes.set(code, email);

    const { data: app, error: appErr } = await supabase
      .from("applications")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (appErr) {
      console.error(`Lookup failed for ${email}: ${appErr.message}`);
      errors++;
      continue;
    }
    if (!app) {
      unmatched.push({ name, email });
      continue;
    }

    const { error: upsertErr } = await supabase
      .from("matching_codes")
      .upsert({ id: app.id, code }, { onConflict: "id" });
    if (upsertErr) {
      console.error(`Failed to save code for ${email}: ${upsertErr.message}`);
      errors++;
      continue;
    }
    matched++;
  }

  console.log(`\nImported ${matched} matching code(s) from ${path.basename(csvPath)}.`);
  if (duplicateInCsv.length) {
    console.log(`\n${duplicateInCsv.length} row(s) skipped as duplicates within the CSV:`);
    duplicateInCsv.forEach((m) => console.log(`  - ${m}`));
  }
  if (unmatched.length) {
    console.log(`\n${unmatched.length} row(s) had no matching application (check for a different signup email):`);
    unmatched.forEach((u) => console.log(`  - ${u.name} <${u.email}>`));
  }
  if (errors) console.log(`\n${errors} row(s) failed with a database error — see above.`);
}

main();
