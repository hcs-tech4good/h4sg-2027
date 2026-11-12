// Audio and haptic cues, so the operator knows the result without looking.

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, duration: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.02);
}

export type Cue = "success" | "warning" | "error";

export function playCue(cue: Cue, withSound: boolean) {
  try {
    navigator.vibrate?.(cue === "success" ? 80 : cue === "warning" ? [80, 60, 80] : [250]);
  } catch {
    // Vibration is optional.
  }
  if (!withSound) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (cue === "success") {
      tone(880, 0, 0.12);
      tone(1320, 0.13, 0.16);
    } else if (cue === "warning") {
      tone(660, 0, 0.14);
      tone(660, 0.2, 0.14);
    } else {
      tone(220, 0, 0.35);
    }
  } catch {
    // Audio is optional.
  }
}
