// Imports check-in QR tokens from a CSV of (name, email, qr_token) into the
// checkin_tokens table, matched to accepted hackers by email.
//
// Usage:
//   node scripts/import-qr-tokens.mjs path/to/tokens.csv --dry-run
//   node scripts/import-qr-tokens.mjs path/to/tokens.csv
//
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. The CSV holds live check-in credentials: keep it
// out of the repo (*.csv is git-ignored).

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
const norm = (e) => (e || "").trim().toLowerCase();

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

async function all(query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvArg = args.find((a) => !a.startsWith("--"));
  if (!csvArg) {
    console.error("Usage: node scripts/import-qr-tokens.mjs path/to/tokens.csv [--dry-run]");
    process.exit(1);
  }
  const csvPath = path.resolve(csvArg);
  if (!existsSync(csvPath)) { console.error(`CSV not found: ${csvPath}`); process.exit(1); }

  const rows = parseCsv(readFileSync(csvPath, "utf8").replace(/^﻿/, ""));
  const header = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  const iEmail = header.indexOf("email");
  const iToken = header.indexOf("qr_token");
  if (iEmail < 0 || iToken < 0) {
    console.error(`CSV header must include "email" and "qr_token". Found: ${header.join(", ")}`);
    process.exit(1);
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Accepted, released hackers, findable by application email or login email.
  const accepted = (await all(() => supabase.from("decisions").select("id, type, released").order("id")))
    .filter((d) => d.released && d.type === "accepted");
  const acceptedIds = new Set(accepted.map((d) => d.id));
  const idByEmail = new Map();
  for (let i = 0; i < accepted.length; i += 200) {
    const ids = accepted.slice(i, i + 200).map((d) => d.id);
    const { data, error } = await supabase.from("applications").select("id, email").in("id", ids);
    if (error) throw new Error(error.message);
    for (const a of data) if (a.email) idByEmail.set(norm(a.email), a.id);
  }
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      if (acceptedIds.has(u.id) && u.email && !idByEmail.has(norm(u.email))) idByEmail.set(norm(u.email), u.id);
    }
    if (data.users.length < 1000) break;
  }

  const seenTokens = new Set();
  const seenIds = new Set();
  const toWrite = [];
  const skipped = [];
  for (const r of rows) {
    const email = norm(r[iEmail]);
    const token = (r[iToken] || "").trim();
    if (!email || !token) { skipped.push(`missing email or token: ${email || "(blank)"}`); continue; }
    if (token.length > 200 || /\s/.test(token)) { skipped.push(`malformed token for ${email}`); continue; }
    if (seenTokens.has(token)) { skipped.push(`duplicate token in CSV for ${email}`); continue; }
    const id = idByEmail.get(email);
    if (!id) { skipped.push(`not an accepted hacker: ${email}`); continue; }
    if (seenIds.has(id)) { skipped.push(`second token for the same hacker: ${email}`); continue; }
    seenTokens.add(token);
    seenIds.add(id);
    toWrite.push({ id, token });
  }

  console.log(`${rows.length} CSV rows | ${toWrite.length} match accepted hackers | ${skipped.length} skipped`);
  for (const s of skipped) console.log(`  skipped: ${s}`);

  if (dryRun) { console.log("\nDry run: nothing written."); return; }

  let written = 0;
  for (let i = 0; i < toWrite.length; i += 200) {
    const { data, error } = await supabase
      .from("checkin_tokens")
      .upsert(toWrite.slice(i, i + 200), { onConflict: "id" })
      .select("id");
    if (error) { console.error(`Write failed: ${error.message}`); process.exit(1); }
    written += data.length;
  }
  console.log(`\nWrote ${written} check-in token(s).`);
}

main();
