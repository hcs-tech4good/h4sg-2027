// Imports judging assignments (project, table, track, time slot) from:
//   1. the judging plan CSV (record_type,id,name,...,table_location,track_id,...)
//   2. the Devpost projects export with PII (team member names and emails)
//
// Projects are matched to Devpost by title. Every team member email gets a
// row, so anyone who logs in with that email sees their table. A member whose
// Devpost email isn't a portal email is also matched by exact full name, but
// only when exactly one accepted, checked-in hacker has that name; their
// portal login email then gets a row too. Judges already on a row are left
// untouched, so this is safe to re-run. An email that already has a row for a
// different project (e.g. from an earlier round) is skipped and reported,
// unless --overwrite is passed.
//
// Usage:
//   node scripts/import-judging.mjs judging.csv devpost.csv --time "10 AM to 11 AM" --dry-run
//   node scripts/import-judging.mjs judging.csv devpost.csv --time "10 AM to 11 AM"
//
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. Both CSVs hold personal data: keep them out of
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

function readCsv(file) {
  const p = path.resolve(file);
  if (!existsSync(p)) { console.error(`CSV not found: ${p}`); process.exit(1); }
  const rows = parseCsv(readFileSync(p, "utf8").replace(/^﻿/, ""));
  const header = rows.shift()?.map((h) => h.trim()) ?? [];
  return { header, rows };
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

// Spreadsheet exports escape a leading "+", "=", "-" or "@" with an apostrophe.
const clean = (s) => (s ?? "").trim().replace(/^'(?=[=+\-@])/, "").trim();
const exactKey = (s) => clean(s).toLowerCase();
const looseKey = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const nameKey = (f, l) => `${(f ?? "").trim().toLowerCase().replace(/\s+/g, " ")}|${(l ?? "").trim().toLowerCase().replace(/\s+/g, " ")}`;

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const overwrite = args.includes("--overwrite");
  const timeAt = args.indexOf("--time");
  const timeSlot = timeAt >= 0 ? (args[timeAt + 1] ?? "").trim() : null;
  const [judgingArg, devpostArg] = args.filter((a, i) => !a.startsWith("--") && (timeAt < 0 || i !== timeAt + 1));
  if (!judgingArg || !devpostArg || timeSlot === "") {
    console.error('Usage: node scripts/import-judging.mjs judging.csv devpost.csv [--time "10 AM to 11 AM"] [--dry-run]');
    process.exit(1);
  }

  // ---- Judging plan: projects (table, track) and track names ----
  const judging = readCsv(judgingArg);
  const jcol = (n) => judging.header.indexOf(n);
  const [jType, jId, jName, jTable, jTrack] = ["record_type", "id", "name", "table_location", "track_id"].map(jcol);
  if ([jType, jId, jName, jTable, jTrack].some((i) => i < 0)) {
    console.error(`Judging CSV is missing columns. Found: ${judging.header.join(", ")}`);
    process.exit(1);
  }
  const trackNames = new Map(judging.rows.filter((r) => r[jType] === "track").map((r) => [r[jId], clean(r[jName])]));
  const projects = judging.rows
    .filter((r) => r[jType] === "project")
    .map((r) => ({ name: clean(r[jName]), table: clean(r[jTable]), track: trackNames.get(r[jTrack]) ?? (clean(r[jTrack]) || null) }));

  // ---- Devpost: team members per project title ----
  const devpost = readCsv(devpostArg);
  const dcol = (n) => devpost.header.indexOf(n);
  const [dTitle, sFirst, sLast, sEmail, m1First] =
    ["Project Title", "Submitter First Name", "Submitter Last Name", "Submitter Email", "Team Member 1 First Name"].map(dcol);
  if ([dTitle, sFirst, sLast, sEmail, m1First].some((i) => i < 0)) {
    console.error(`Devpost CSV is missing columns. Found: ${devpost.header.join(", ")}`);
    process.exit(1);
  }
  const byExact = new Map(), byLoose = new Map();
  for (const r of devpost.rows) {
    const people = [[r[sFirst], r[sLast], r[sEmail]]];
    for (let i = m1First; i + 2 < r.length; i += 3) people.push([r[i], r[i + 1], r[i + 2]]);
    const members = people
      .map(([f, l, e]) => ({ first: (f ?? "").trim(), last: (l ?? "").trim(), email: (e ?? "").trim().toLowerCase() }))
      .filter((m) => m.email.includes("@"));
    const team = { title: clean(r[dTitle]), members };
    for (const [map, key] of [[byExact, exactKey(r[dTitle])], [byLoose, looseKey(r[dTitle])]]) {
      map.set(key, [...(map.get(key) ?? []), team]);
    }
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- Portal accounts ----
  const idByEmail = new Map();
  const loginEmail = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      if (!u.email) continue;
      idByEmail.set(u.email.toLowerCase(), u.id);
      loginEmail.set(u.id, u.email.toLowerCase());
    }
    if (data.users.length < 1000) break;
  }
  for (const a of await all(() => supabase.from("applications").select("id, email").order("id"))) {
    if (a.email && !idByEmail.has(a.email.toLowerCase())) idByEmail.set(a.email.toLowerCase(), a.id);
  }
  const accepted = new Set(
    (await all(() => supabase.from("decisions").select("id").eq("released", true).eq("type", "accepted").order("id"))).map((d) => d.id)
  );
  const checkedIn = new Set(
    (await all(() => supabase.from("checkins").select("id").eq("checked_in", true).order("id"))).map((d) => d.id)
  );
  // Name fallback: only names held by exactly one accepted, checked-in hacker.
  const idByName = new Map();
  for (const p of await all(() => supabase.from("profiles").select("id, first_name, last_name").order("id"))) {
    if (!accepted.has(p.id) || !checkedIn.has(p.id)) continue;
    const k = nameKey(p.first_name, p.last_name);
    idByName.set(k, idByName.has(k) ? null : p.id);
  }

  // ---- Match ----
  const rows = new Map(); // email -> row
  const hackers = new Set();
  const report = { noTeam: [], noneInPortal: [], notInPortal: [], byName: [], conflicts: [] };
  const add = (email, p) => {
    const prev = rows.get(email);
    if (prev && prev.project_name !== p.name) {
      report.conflicts.push(`${email}: ${prev.project_name} and ${p.name}`);
      return false;
    }
    rows.set(email, {
      email,
      project_name: p.name,
      table_location: p.table,
      track: p.track,
      ...(timeSlot !== null && { time_slot: timeSlot }),
      updated_at: new Date().toISOString(),
    });
    return true;
  };
  for (const p of projects) {
    const loose = byLoose.get(looseKey(p.name)) ?? [];
    const teams = byExact.get(exactKey(p.name)) ?? (loose.length === 1 ? loose : []);
    if (teams.length === 0) { report.noTeam.push(p.name); continue; }
    const members = new Map();
    for (const t of teams) for (const m of t.members) members.set(m.email, m);
    let inPortal = 0;
    for (const m of members.values()) {
      if (!add(m.email, p)) continue;
      let id = idByEmail.get(m.email);
      if (!id) {
        id = idByName.get(nameKey(m.first, m.last)) ?? undefined;
        if (id && add(loginEmail.get(id), p)) report.byName.push(`${m.first} ${m.last} <${m.email}> → ${loginEmail.get(id)} (${p.name})`);
        else id = undefined;
      }
      if (id) { hackers.add(id); inPortal++; }
      else report.notInPortal.push(`${m.first} ${m.last} <${m.email}> (${p.name})`);
    }
    if (inPortal === 0) report.noneInPortal.push(p.name);
  }

  // Don't replace an existing assignment for a different project.
  const existing = new Map();
  const emails = [...rows.keys()];
  for (let i = 0; i < emails.length; i += 200) {
    const { data, error } = await supabase
      .from("judging_assignments")
      .select("email, project_name, table_location, time_slot")
      .in("email", emails.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const r of data) existing.set(r.email, r);
  }
  const kept = [];
  for (const [email, row] of rows) {
    const prev = existing.get(email);
    if (prev && prev.project_name !== row.project_name) {
      kept.push(`${email}: has ${prev.project_name} (${prev.table_location}, ${prev.time_slot ?? "no time"}); this file says ${row.project_name}`);
      if (!overwrite) rows.delete(email);
    }
  }

  const list = [...rows.values()];
  const ids = [...hackers];
  console.log(`${projects.length} projects | ${list.length} emails | ${ids.length} portal hackers (${report.byName.length} by name)`);
  console.log(`  time slot: ${timeSlot ?? "(unchanged)"}`);
  console.log(`  of those hackers, not accepted: ${ids.filter((i) => !accepted.has(i)).length} | not checked in: ${ids.filter((i) => !checkedIn.has(i)).length}`);
  const section = (label, items) => { if (items.length) { console.log(`\n${label} (${items.length}):`); for (const i of items) console.log(`  ${i}`); } };
  section("Projects with no Devpost team", report.noTeam);
  section("Projects with nobody in the portal (rows saved by email anyway)", report.noneInPortal);
  section("Team members not in the portal (rows saved by email anyway)", report.notInPortal);
  section("On two projects in this file (kept the first)", report.conflicts);
  section(overwrite ? "Replaced an existing assignment" : "Already assigned to another project (left unchanged; --overwrite to replace)", kept);
  section("Matched by name", report.byName);

  if (dryRun) { console.log("\nDry run: nothing written."); return; }

  let written = 0;
  for (let i = 0; i < list.length; i += 200) {
    const { data, error } = await supabase
      .from("judging_assignments")
      .upsert(list.slice(i, i + 200), { onConflict: "email" })
      .select("email");
    if (error) { console.error(`Write failed: ${error.message}`); process.exit(1); }
    written += data.length;
  }
  console.log(`\nWrote ${written} judging assignment(s).`);
}

main();
