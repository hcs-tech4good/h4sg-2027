"use client";

import { useEffect, useRef } from "react";

// A friendly fish that turns toward the pointer and follows it with its eye.
export function AuthBuddy() {
  const fishRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pupilRef = useRef<SVGGElement>(null);

  useEffect(() => {
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;

    function update() {
      frame = 0;
      const fish = fishRef.current, body = bodyRef.current, pupil = pupilRef.current;
      if (!fish || !body || !pupil || !pointer) return;
      const box = fish.getBoundingClientRect();
      const dx = pointer.x - (box.left + box.width / 2);
      const dy = pointer.y - (box.top + box.height / 2);
      const facingLeft = dx < -8;
      // Tilt toward the pointer, limited so the fish never swims upside down.
      const tilt = Math.max(-28, Math.min(28, Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI));
      body.style.transform = `scaleX(${facingLeft ? -1 : 1}) rotate(${tilt}deg)`;
      // Pupil offset is in the body's own (flipped, tilted) frame.
      const local = Math.atan2(dy, Math.abs(dx)) - tilt * Math.PI / 180;
      const reach = Math.min(1, Math.hypot(dx, dy) / 120) * 4.5;
      pupil.setAttribute("transform", `translate(${(Math.cos(local) * reach).toFixed(2)} ${(Math.sin(local) * reach).toFixed(2)})`);
    }
    function onMove(e: PointerEvent) {
      pointer = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(frame); };
  }, []);

  return (
    <div className="auth-buddy" ref={fishRef} aria-hidden="true">
      <div className="auth-buddy-body" ref={bodyRef}>
        <svg viewBox="0 0 140 100" width="128" height="92">
          <defs>
            <linearGradient id="auth-buddy-scales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3be6ae" />
              <stop offset="1" stopColor="#079d74" />
            </linearGradient>
          </defs>
          <path d="M32 50 L6 28 Q14 50 6 72 Z" fill="#06875f" />
          <path d="M56 22 Q70 2 94 20 Z" fill="#06875f" />
          <ellipse cx="72" cy="52" rx="46" ry="33" fill="url(#auth-buddy-scales)" />
          <ellipse cx="74" cy="66" rx="34" ry="15" fill="#c9f8e6" opacity=".55" />
          <path d="M52 24 Q44 52 52 80" stroke="#fff" strokeWidth="4" fill="none" opacity=".45" strokeLinecap="round" />
          <path d="M66 20 Q58 52 66 84" stroke="#fff" strokeWidth="3" fill="none" opacity=".3" strokeLinecap="round" />
          <path d="M70 60 Q80 72 88 60 Z" fill="#06875f" opacity=".7" />
          <circle cx="106" cy="62" r="5" fill="#ff9fb4" opacity=".55" />
          <path d="M112 66 Q116 70 120 66" stroke="#0d2f3d" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <circle cx="98" cy="44" r="13" fill="#fff" />
          <g ref={pupilRef}>
            <circle cx="98" cy="44" r="6.5" fill="#0d2f3d" />
            <circle cx="100.5" cy="41.5" r="2.2" fill="#fff" />
          </g>
        </svg>
      </div>
      <span className="auth-buddy-bubble" />
      <span className="auth-buddy-bubble" />
    </div>
  );
}
