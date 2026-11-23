"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserRound, LogOut, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

interface AppNavProps { profile: Profile; email: string; showAnnouncements: boolean }

export function AppNav({ profile, showAnnouncements }: AppNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isStaff = profile.role === "admin" || profile.role === "reviewer";
  const isAdmin = profile.role === "admin";
  const roleLabel = isAdmin ? "Administrator" : isStaff ? "Review team" : "Hacker workspace";
  const hackerLinks = [
    { href: "/dashboard", label: "Overview" },
    { href: "/apply", label: "My application" },
    ...(showAnnouncements ? [{ href: "/announcements", label: "Announcements" }] : []),
    { href: "/faq", label: "Help & FAQ" },
  ];
  const staffLinks = [
    { href: "/dashboard", label: "Overview" },
    { href: "/applications", label: "Applications" },
    { href: "/decisions", label: "Decisions" },
    { href: "/scan", label: "Check-in station" },
    { href: "/announcements", label: "Announcements" },
    ...(isAdmin ? [
      { href: "/announcements/new", label: "Create announcement" },
      { href: "/tokens", label: "Invitations" },
      { href: "/manage-users", label: "People & access" },
    ] : []),
  ];
  const links = isStaff ? staffLinks : hackerLinks;
  const current = links.find((link) => pathname === link.href)
    ?? [...links].reverse().find((link) => pathname.startsWith(`${link.href}/`));

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") setMobileOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  async function handleSignOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    // If the server can't be reached or the session is already gone, still clear this
    // browser's session so the user is never stuck "signed in".
    if (error) await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/signin";
  }

  return <>
    <a className="portal-skip" href="#portal-content">Skip to content</a>
    <header className="portal-header">
      <div className="portal-header-main">
        <a href="/" className="portal-brand"><Image unoptimized src="/h4sg-logo.png" alt="" width={34} height={40} /><span>Hack<span className="portal-brand-four">4</span>SocialGood <small>Portal</small></span></a>
        <div className="portal-account"><span className="portal-season">March 5–7, 2027</span><Link href="/profile" className="portal-profile-link" aria-label="Your profile"><UserRound size={16} /><span>{profile.first_name}</span></Link><button type="button" onClick={handleSignOut} className="portal-signout" aria-label="Sign out"><LogOut size={16} /><span>Sign out</span></button><button type="button" className="portal-menu-button" onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} aria-controls="portal-navigation" aria-label={mobileOpen ? "Close navigation" : "Open navigation"}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
      </div>
      <nav id="portal-navigation" aria-label="Portal navigation" className={cn("portal-horizontal-nav", mobileOpen && "is-open")}>
        {links.map(({ href, label }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={current?.href === href ? "page" : undefined}>{label}</Link>)}
        {isStaff && <span className="portal-role-label">{roleLabel}</span>}
      </nav>
    </header>
  </>;
}
