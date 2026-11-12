// Small original SVG illustrations, shared across portal surfaces.
// Decorative artwork never intercepts input or adds screen-reader noise.
export type MarineKind = "fish" | "jellyfish" | "shell" | "starfish" | "turtle" | "coral";

export function MarineIcon({ kind = "fish", className = "" }: { kind?: MarineKind; className?: string }) {
  return <svg className={`marine-icon marine-${kind} ${className}`} viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false">
    {kind === "fish" && <>
      <path d="M22 40 8 25v30l14-15Z" fill="#f5b87b" />
      <path d="M24 39c0-15 15-22 29-17 11 4 17 12 21 18-4 7-11 15-22 18-14 4-28-4-28-19Z" fill="#6fc6b1" />
      <path d="m36 24 5-11 12 9M37 57l8 10 9-10" fill="#44a994" />
      <path d="M40 24c-5 10-5 22 0 33" stroke="#e9fff6" strokeWidth="6" />
      <circle cx="61" cy="36" r="4" fill="#f7fffc" /><circle cx="62" cy="36" r="1.8" fill="#174a51" />
      <path d="m69 44 3-1" stroke="#174a51" strokeWidth="1.5" strokeLinecap="round" />
    </>}
    {kind === "jellyfish" && <>
      <path d="M22 43c-8 11 9 16 2 29M34 44c-8 11 10 17 2 30M47 44c-8 11 9 17 2 28M58 42c-9 12 10 17 2 26" stroke="#b39ad7" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 40C13 5 66 4 67 40c-5 5-9 2-13 0-5 5-9 2-14 0-5 5-10 3-14 0-5 4-9 4-13 0Z" fill="#d1b4e8" />
      <path d="M23 29c3-9 10-13 17-14" stroke="#f7ecff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="35" cy="33" r="1.7" fill="#73588f" /><circle cx="47" cy="33" r="1.7" fill="#73588f" /><path d="M39 37q2 2 4 0" stroke="#73588f" strokeWidth="1.3" strokeLinecap="round" />
    </>}
    {kind === "shell" && <>
      <path d="M36 65C22 55 8 42 11 27c2-11 12-14 20-9 5-12 16-12 21-1 11-4 20 2 18 14-1 13-15 25-25 34Z" fill="#f3beaa" />
      <path d="m38 61-18-35m20 34L36 21m7 39 7-37m-4 37 15-28" stroke="#d98e81" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 62q10-5 20 0l-3 8H35Z" fill="#e7a899" /><path d="M20 23q3-3 6-1" stroke="#fff0df" strokeWidth="3" strokeLinecap="round" />
    </>}
    {kind === "starfish" && <>
      <path d="m39 8 10 23 24 3-19 16 5 23-20-13-21 12 5-24L7 32l23-2Z" fill="#f2ae77" stroke="#dc9462" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m39 22 1 28m-16-13 17 10 17-9M31 58l10-11 9 13" stroke="#ffe0ac" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 6" />
      <circle cx="35" cy="40" r="1.5" fill="#8d674a" /><circle cx="45" cy="40" r="1.5" fill="#8d674a" />
    </>}
    {kind === "turtle" && <>
      <path d="M26 28C9 10 5 23 20 39M49 25c13-17 24-10 10 9M25 51C9 64 20 70 33 56M50 54c14 14 23 4 9-7" fill="#9bcba5" stroke="#7db991" strokeWidth="1.5" />
      <ellipse cx="39" cy="41" rx="26" ry="21" fill="#60aa8d" /><path d="m31 25 15-2 11 13-7 17-16 5-13-14 10-19Z" stroke="#3d8c75" strokeWidth="2" /><path d="m31 25 5 13 21-2m-21 2-2 20m2-20-15 6m15-6 14 15" stroke="#3d8c75" strokeWidth="2" />
      <ellipse cx="68" cy="35" rx="10" ry="9" fill="#a1ceab" /><circle cx="71" cy="32" r="1.6" fill="#28584c" /><path d="m17 44-9 5 10 1" fill="#9bcba5" />
    </>}
    {kind === "coral" && <>
      <path d="M39 71V23m0 21L22 34V20m0 12L11 24m28 34 18-15V26m0 14 12-9M39 34l11-15V10" stroke="#e8a0a4" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 73h23" stroke="#c184a0" strokeWidth="6" strokeLinecap="round" />
      <circle cx="39" cy="21" r="4" fill="#f9ced0" /><circle cx="22" cy="18" r="4" fill="#f9ced0" /><circle cx="57" cy="24" r="4" fill="#f9ced0" />
    </>}
  </svg>;
}

export function OceanFriends() {
  return <div className="ocean-friends" aria-hidden="true">
    <svg className="ocean-current-lines" viewBox="0 0 320 130"><path d="M5 74q40-18 80 0t80 0 80 0 80 0M28 97q35-14 70 0t70 0 70 0" stroke="#86c9bd" strokeWidth="1" strokeDasharray="3 7" fill="none" /></svg>
    <span className="ocean-friend-turtle"><MarineIcon kind="turtle" /></span>
    <span className="ocean-friend-jelly"><MarineIcon kind="jellyfish" /></span>
    <span className="ocean-friend-fish"><MarineIcon kind="fish" /></span>
    <span className="ocean-bubble bubble-one" /><span className="ocean-bubble bubble-two" /><span className="ocean-bubble bubble-three" />
  </div>;
}

export function PortalSeabed() {
  return <div className="portal-seabed" aria-hidden="true"><div className="seabed-left"><MarineIcon kind="coral" /><MarineIcon kind="shell" /><MarineIcon kind="starfish" /></div><svg viewBox="0 0 1000 40" preserveAspectRatio="none"><path d="M0 25q125-28 250-5t250 0 250 0 250 5" stroke="#c4e5db" strokeWidth="1.5" fill="none" /></svg><div className="seabed-right"><MarineIcon kind="coral" /><MarineIcon kind="coral" /></div></div>;
}
