"use client";

import Link from "next/link";
import { ArrowUpRight, ClipboardList, CheckCheck, Users, ScanLine, FileClock, Send, FileText } from "lucide-react";
import { PortalPageHeading } from "@/components/portal-page-heading";

interface AdminDashboardProps {
  stats: { totalApps: number; submittedApps: number; totalDecisions: number; stagedDecisions: number; releasedDecisions: number; confirmations: number; checkins: number };
}

export function AdminDashboard({ stats }: AdminDashboardProps) {
  const statCards = [
    { label: "Total applications", value: stats.totalApps, icon: ClipboardList, description: "All application records" },
    { label: "Submitted", value: stats.submittedApps, icon: FileText, description: "Ready for your review" },
    { label: "Decisions made", value: stats.totalDecisions, icon: CheckCheck, description: "Across the applicant pool" },
    { label: "Staged decisions", value: stats.stagedDecisions, icon: FileClock, description: "Awaiting release" },
    { label: "Released", value: stats.releasedDecisions, icon: Send, description: "Visible to applicants" },
    { label: "Confirmations", value: stats.confirmations, icon: Users, description: "Recorded attendance responses" },
    { label: "Checked in", value: stats.checkins, icon: ScanLine, description: "Arrivals at the event" },
  ];
  return <div className="space-y-7">
    <PortalPageHeading eyebrow="Event operations / 2027" title="Event overview." description="A shared view of applications, decisions, and event arrivals."><Link className="portal-cta" href="/applications">Review applications <ArrowUpRight size={16} /></Link></PortalPageHeading>
    <div className="portal-stats-grid">{statCards.map(({ label, value, icon: Icon, description }) => <section className="portal-stat-card" key={label}><div><span>{label}</span><Icon size={20} strokeWidth={1.6} /></div><strong>{value.toLocaleString()}</strong><p>{description}</p></section>)}</div>
    <div className="portal-quick-links"><Link href="/applications"><ClipboardList size={23} /><span><strong>Application review</strong><small>Read submissions and evaluate applicants</small></span><ArrowUpRight size={19} /></Link><Link href="/decisions"><CheckCheck size={23} /><span><strong>Decision workspace</strong><small>Stage outcomes and release updates</small></span><ArrowUpRight size={19} /></Link><Link href="/scan"><ScanLine size={23} /><span><strong>Welcome your hackers</strong><small>Open the event check-in station</small></span><ArrowUpRight size={19} /></Link></div>
  </div>;
}
