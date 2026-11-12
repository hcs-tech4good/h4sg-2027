import { PortalSeabed } from "@/components/marine-art";
import { AppNav } from "@/components/app-nav";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import type { Profile } from "@/types/database";

export function PortalShell({ profile, email, showAnnouncements, verified = true, children }: {
  profile: Profile; email: string; showAnnouncements: boolean; verified?: boolean; children: React.ReactNode;
}) {
  return <div className="portal-shell">
    <AppNav profile={profile} email={email} showAnnouncements={showAnnouncements} />
    <div className="portal-workspace">
      <main id="portal-content" tabIndex={-1} className="portal-main">
        {!verified && <div className="mb-6"><EmailVerificationBanner email={email} /></div>}
        {children}
      </main>
      <PortalSeabed />
      <footer className="portal-footer"><span><a href="https://hcs.harvard.edu/" target="_blank" rel="noopener noreferrer">© Harvard Computer Society</a></span><a href="/">Back to the main site ↗</a><a href="mailto:operations@t4sg.dev">Contact the team</a></footer>
    </div>
  </div>;
}
