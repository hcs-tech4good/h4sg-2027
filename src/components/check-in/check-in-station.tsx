"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  RotateCcw,
  SwitchCamera,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import type { StationResult, StationStats } from "@/lib/check-in";
import { playCue, type Cue } from "@/components/check-in/feedback";
import { useQrScanner, SCAN_REGION, type FacingMode, type GetStream } from "@/components/check-in/use-qr-scanner";

interface Actions {
  checkIn: (input: { token: string } | { hhid: string; lastName: string }) => Promise<StationResult>;
  undo: (userId: string) => Promise<{ ok: boolean }>;
  stats: () => Promise<StationStats>;
}

interface CheckInStationProps {
  initialStats: StationStats;
  isStationAccount: boolean;
  actions: Actions;
  getStream?: GetStream;
}

type Shown = StationResult & { at: number; undone?: boolean };

// Ignore the same QR for this long, so a code held in front of the camera
// isn't processed over and over.
const SAME_CODE_COOLDOWN_MS = 5000;
const STATS_REFRESH_MS = 20000;
const RECENT_LIMIT = 6;

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

const DECISION_LABEL: Record<string, string> = {
  waitlisted: "They're on the waitlist.",
  rejected: "They weren't accepted.",
  staged: "Their decision hasn't been released yet.",
  none: "They don't have a decision.",
};

function cueFor(r: StationResult): Cue {
  if (r.status === "checked_in") return "success";
  if (r.status === "already_checked_in") return "warning";
  return "error";
}

type Tone = "success" | "warning" | "error" | "neutral";
function toneFor(r: StationResult | null): Tone {
  if (!r) return "neutral";
  if (r.status === "checked_in") return "success";
  if (r.status === "already_checked_in") return "warning";
  return "error";
}

const TONE_STYLES: Record<Tone, { card: string; bracket: string; dot: string }> = {
  success: { card: "bg-emerald-600 text-white", bracket: "border-emerald-400", dot: "bg-emerald-500" },
  warning: { card: "bg-amber-400 text-gray-950", bracket: "border-amber-300", dot: "bg-amber-400" },
  error: { card: "bg-red-600 text-white", bracket: "border-red-400", dot: "bg-red-500" },
  neutral: { card: "bg-gray-800 text-gray-100", bracket: "border-white/90", dot: "bg-gray-500" },
};

function headline(r: StationResult): string {
  switch (r.status) {
    case "checked_in":
      return "Checked in";
    case "already_checked_in":
      return "Already checked in";
    case "not_accepted":
      return "Not accepted. Do not admit";
    case "unknown":
      return "No matching hacker";
    case "not_our_code":
      return "Not a Hack 4 Social Good code";
    case "invalid":
      return "Couldn't check in";
  }
}

export function CheckInStation({ initialStats, isStationAccount, actions, getStream }: CheckInStationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<FacingMode>("environment");
  const [sound, setSound] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [recent, setRecent] = useState<Shown[]>([]);
  const [stats, setStats] = useState(initialStats);
  const [flash, setFlash] = useState<Tone>("neutral");
  const [hhid, setHhid] = useState("");
  const [lastName, setLastName] = useState("");
  const [undoing, setUndoing] = useState(false);
  const lastCode = useRef<{ text: string; at: number } | null>(null);
  const busyRef = useRef(false);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await actions.stats());
    } catch {
      // Keep the last numbers; the next refresh will try again.
    }
  }, [actions]);

  const show = useCallback(
    (result: StationResult) => {
      const entry: Shown = { ...result, at: Date.now() };
      setShown(entry);
      setRecent((list) => [entry, ...list].slice(0, RECENT_LIMIT));
      const tone = toneFor(result);
      setFlash(tone);
      setTimeout(() => setFlash("neutral"), 1200);
      playCue(cueFor(result), sound);
      if (result.status === "checked_in") void refreshStats();
    },
    [sound, refreshStats]
  );

  const submit = useCallback(
    async (input: { token: string } | { hhid: string; lastName: string }) => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      try {
        show(await actions.checkIn(input));
        return true;
      } catch {
        show({ status: "invalid", message: "Couldn't reach the server. Check the connection, or sign in again." });
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [actions, show]
  );

  const onDecode = useCallback(
    (text: string) => {
      const now = Date.now();
      if (lastCode.current && lastCode.current.text === text && now - lastCode.current.at < SAME_CODE_COOLDOWN_MS) {
        return;
      }
      if (busyRef.current) return;
      lastCode.current = { text, at: now };
      void submit({ token: text });
    },
    [submit]
  );

  const camera = useQrScanner({ videoRef, onDecode, paused: busy, facing, getStream });

  useEffect(() => {
    const id = setInterval(refreshStats, STATS_REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshStats]);

  // Keep the screen awake while the station is open.
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    const acquire = async () => {
      try {
        if (document.visibilityState === "visible" && nav.wakeLock) lock = await nav.wakeLock.request("screen");
      } catch {
        // Optional.
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, []);

  async function handleManual(e: React.FormEvent) {
    e.preventDefault();
    const ok = await submit({ hhid, lastName });
    if (ok) {
      setHhid("");
      setLastName("");
    }
  }

  async function handleUndo() {
    if (!shown || shown.status !== "checked_in" || undoing) return;
    if (!confirm(`Undo the check-in for ${shown.name}?`)) return;
    setUndoing(true);
    try {
      const res = await actions.undo(shown.userId);
      if (res.ok) {
        const at = shown.at;
        setShown({ ...shown, undone: true });
        setRecent((list) => list.map((r) => (r.at === at ? { ...r, undone: true } : r)));
        lastCode.current = null;
        void refreshStats();
      } else {
        alert("This check-in can no longer be undone (it's older than 15 minutes).");
      }
    } catch {
      alert("Couldn't undo. Please try again.");
    } finally {
      setUndoing(false);
    }
  }

  async function signOut() {
    // Several stations share one account: only sign out this device. The
    // default ("global") would sign every station out at once.
    await createClient().auth.signOut({ scope: "local" });
    window.location.href = "/signin";
  }

  const tone = shown?.undone ? "neutral" : toneFor(shown);
  const inset = `${((1 - SCAN_REGION) / 2) * 100}%`;
  const pct = stats.accepted > 0 ? Math.round((stats.checkedIn / stats.accepted) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
          <img src="/email-logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-tight">Hack 4 Social Good Check-in</p>
            <p className="text-xs text-gray-400" aria-live="polite">
              {stats.checkedIn} of {stats.accepted} checked in ({pct}%)
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isStationAccount && (
            <Link href="/dashboard" className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10">
              Portal
            </Link>
          )}
          <button type="button" onClick={signOut} className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:items-start">
        {/* Camera */}
        <section className="space-y-3">
          <div className="relative mx-auto aspect-square w-full max-w-[480px] overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`}
              muted
              playsInline
              aria-label="Camera preview"
            />

            {camera === "running" && (
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                {/* Dim everything outside the scanning square. */}
                <div className="absolute rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" style={{ inset }} />
                <div className="absolute" style={{ inset }}>
                  {(["left-0 top-0 border-l-4 border-t-4 rounded-tl-xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-xl"] as const).map((pos) => (
                    <span
                      key={pos}
                      className={`absolute h-10 w-10 transition-colors duration-300 ${pos} ${TONE_STYLES[flash].bracket}`}
                    />
                  ))}
                  {!busy && <span className="scan-line absolute inset-x-3 h-0.5 rounded-full bg-white/70" />}
                </div>
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                  </div>
                )}
              </div>
            )}

            {camera !== "running" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                {camera === "starting" ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                    <p className="text-sm text-gray-300">Starting camera...</p>
                  </>
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-gray-400" />
                    <p className="text-sm font-medium">
                      {camera === "denied" ? "Camera access is blocked" : "No camera available"}
                    </p>
                    <p className="max-w-xs text-xs text-gray-400">
                      {camera === "denied"
                        ? "Allow camera access for this site in your browser settings, then reload the page. Manual check-in below still works."
                        : "Use a device with a camera, or check hackers in manually below."}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mx-auto flex max-w-[480px] items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
              className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            >
              <SwitchCamera className="h-4 w-4" /> Flip camera
            </button>
            <button
              type="button"
              onClick={() => setSound((s) => !s)}
              aria-pressed={sound}
              className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            >
              {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Sound {sound ? "on" : "off"}
            </button>
          </div>
        </section>

        {/* Result, manual entry, recent */}
        <section className="space-y-5">
          <div role="status" aria-live="assertive" className={`rounded-2xl p-5 transition-colors ${TONE_STYLES[tone].card}`}>
            {!shown ? (
              <div className="py-6 text-center">
                <p className="text-lg font-semibold">Ready to scan</p>
                <p className="mt-1 text-sm text-gray-400">Hold a hacker&apos;s QR code inside the square.</p>
              </div>
            ) : shown.undone && shown.status === "checked_in" ? (
              <div className="py-4 text-center">
                <p className="text-lg font-semibold">Check-in undone</p>
                <p className="mt-1 text-sm text-gray-300">{shown.name} is no longer checked in.</p>
              </div>
            ) : (
              <ResultBody result={shown} onUndo={handleUndo} undoing={undoing} />
            )}
          </div>

          <form onSubmit={handleManual} className="space-y-3 rounded-2xl border border-white/10 p-4">
            <div>
              <p className="text-sm font-semibold">Can&apos;t scan?</p>
              <p className="text-xs text-gray-400">Check in with the Hacker ID from their dashboard and their last name.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-gray-400">Hacker ID</span>
                <input
                  value={hhid}
                  onChange={(e) => setHhid(e.target.value)}
                  placeholder="H-1234567"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={12}
                  className="h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 font-mono text-base outline-none focus:border-white/40"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-400">Last name</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  autoComplete="off"
                  maxLength={100}
                  className="h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-base outline-none focus:border-white/40"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={busy || !hhid.trim() || !lastName.trim()}
              className="h-11 w-full rounded-md bg-white text-sm font-semibold text-gray-950 transition-opacity disabled:opacity-40"
            >
              {busy ? "Checking..." : "Check in"}
            </button>
          </form>

          {recent.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">This station</p>
              <ul className="divide-y divide-white/5 rounded-2xl border border-white/10">
                {recent.map((r) => (
                  <li key={r.at} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_STYLES[r.undone ? "neutral" : toneFor(r)].dot}`} />
                    <span className="min-w-0 flex-1 truncate">
                      {"name" in r ? r.name : headline(r)}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {r.undone ? "Undone" : headline(r)} · {timeFormat.format(r.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ResultBody({ result, onUndo, undoing }: { result: StationResult; onUndo: () => void; undoing: boolean }) {
  const Icon = result.status === "checked_in" ? CheckCircle2 : result.status === "already_checked_in" ? AlertTriangle : XCircle;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-6 w-6 shrink-0" />
        <p className="text-lg font-bold">{headline(result)}</p>
      </div>

      {"name" in result && (
        <div>
          <p className="break-words text-3xl font-bold leading-tight">{result.name}</p>
          <p className="mt-1 font-mono text-sm opacity-90">{result.hhid}</p>
        </div>
      )}

      {(result.status === "checked_in" || result.status === "already_checked_in") && (
        <div className="space-y-2 text-sm">
          <p>
            {result.status === "already_checked_in" ? "Checked in at " : "Shirt size: "}
            <span className="font-semibold">
              {result.status === "already_checked_in" ? timeFormat.format(new Date(result.checkedInAt)) : result.shirtSize || "not given"}
            </span>
          </p>
          {result.registration === "not_registered" && (
            <p className="rounded-md bg-black/15 px-3 py-2">
              Hasn&apos;t completed registration, so there&apos;s no waiver on file. Ask them to finish it in the portal.
            </p>
          )}
          {result.registration === "not_coming" && (
            <p className="rounded-md bg-black/15 px-3 py-2">Registered as not attending, but they&apos;re accepted, so they can come in.</p>
          )}
          {result.status === "checked_in" && (
            <button
              type="button"
              onClick={onUndo}
              disabled={undoing}
              className="inline-flex items-center gap-1.5 rounded-md bg-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/25 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" /> {undoing ? "Undoing..." : "Undo"}
            </button>
          )}
        </div>
      )}

      {result.status === "not_accepted" && <p className="text-sm">{DECISION_LABEL[result.decision] ?? "They aren't an accepted hacker."}</p>}
      {result.status === "unknown" && (
        <p className="text-sm">This code or Hacker ID and last name doesn&apos;t match an accepted hacker. Double-check, or use manual check-in.</p>
      )}
      {result.status === "not_our_code" && <p className="text-sm">Ask them to open their Hack 4 Social Good portal dashboard and show the check-in QR code.</p>}
      {result.status === "invalid" && <p className="text-sm">{result.message}</p>}
    </div>
  );
}
