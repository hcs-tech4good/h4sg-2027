"use client";

import { useEffect, useRef, useState } from "react";

export type CameraState = "starting" | "running" | "denied" | "unavailable" | "error";
export type FacingMode = "environment" | "user";
export type GetStream = (facing: FacingMode) => Promise<MediaStream>;

// Fraction of the video's shorter side covered by the on-screen scanning
// square. Only this region is decoded, which is faster and matches what the
// operator sees.
export const SCAN_REGION = 0.7;
const DECODE_SIZE = 480;
const DECODE_INTERVAL_MS = 150;

const defaultGetStream: GetStream = (facing) =>
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });

type Decoder = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => Promise<string | null>;

// Prefer the browser's built-in barcode reader (fast, hardware-assisted);
// fall back to jsQR, loaded only when needed, everywhere else (e.g. iOS Safari).
async function createDecoder(): Promise<Decoder> {
  const BD = (globalThis as unknown as {
    BarcodeDetector?: {
      new (opts: { formats: string[] }): { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
      getSupportedFormats(): Promise<string[]>;
    };
  }).BarcodeDetector;
  if (BD) {
    try {
      if ((await BD.getSupportedFormats()).includes("qr_code")) {
        const detector = new BD({ formats: ["qr_code"] });
        return async (canvas) => {
          const codes = await detector.detect(canvas);
          return codes[0]?.rawValue ?? null;
        };
      }
    } catch {
      // Fall through to jsQR.
    }
  }
  const jsQR = (await import("jsqr")).default;
  return async (canvas, ctx) => {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

function classify(e: unknown): CameraState {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") {
    return "unavailable";
  }
  return "error";
}

// Runs the camera and calls onDecode with the text of each QR code it reads.
// Decoding pauses while `paused` is true; the stream keeps running.
export function useQrScanner(opts: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onDecode: (text: string) => void;
  paused: boolean;
  facing: FacingMode;
  getStream?: GetStream;
}) {
  const { videoRef, facing } = opts;
  const [state, setState] = useState<CameraState>("starting");
  const onDecode = useRef(opts.onDecode);
  const paused = useRef(opts.paused);
  const getStream = useRef(opts.getStream ?? defaultGetStream);
  useEffect(() => {
    onDecode.current = opts.onDecode;
    paused.current = opts.paused;
  });

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = DECODE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      setState("starting");
      if (!navigator.mediaDevices?.getUserMedia && !opts.getStream) {
        setState("unavailable");
        return;
      }
      try {
        stream = await getStream.current(facing);
      } catch (e) {
        if (!cancelled) setState(classify(e));
        return;
      }
      if (cancelled || !video || !ctx) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      try {
        await video.play();
      } catch {
        // Autoplay can be refused until a user gesture; frames still arrive.
      }
      if (cancelled) return;
      setState("running");

      const decode = await createDecoder();
      const tick = async () => {
        if (cancelled) return;
        if (!paused.current && video.readyState >= 2 && video.videoWidth > 0) {
          const side = Math.min(video.videoWidth, video.videoHeight) * SCAN_REGION;
          const sx = (video.videoWidth - side) / 2;
          const sy = (video.videoHeight - side) / 2;
          ctx.drawImage(video, sx, sy, side, side, 0, 0, DECODE_SIZE, DECODE_SIZE);
          try {
            const text = await decode(canvas, ctx);
            if (text && !cancelled) onDecode.current(text);
          } catch {
            // A bad frame; keep going.
          }
        }
        timer = setTimeout(tick, DECODE_INTERVAL_MS);
      };
      tick();
    }

    start();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
    // getStream is read through a ref; restart only when the camera changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, videoRef]);

  return state;
}
