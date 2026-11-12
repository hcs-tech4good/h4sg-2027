import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { canViewAnnouncements } from "@/lib/announcement-access";
import { redirect } from "next/navigation";
import { AnnouncementCard } from "@/components/announcement-card";
import { AnnouncementEmailStatus } from "@/components/announcement-email-status";
import type { Announcement } from "@/types/database";

type EmailCounts = { sent: number; pending: number; failed: number };

export default async function AnnouncementsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";

  if (!(await canViewAnnouncements(createAdminClient(), user.id, profile?.role))) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-500 mt-1">Latest updates from the Hack 4 Social Good team</p>
        </div>
        <p className="text-gray-500 py-8 text-center">
          Announcements are only available to accepted hackers.
        </p>
      </div>
    );
  }

  // Read with the user's own session so the database policy applies too.
  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  // Email send status is only loaded for admins, and only they can act on it.
  const emailCounts = new Map<string, EmailCounts>();
  if (isAdmin && announcements && announcements.length > 0) {
    const admin = createAdminClient();
    const count = async (id: string, state: "sent" | "pending" | "failed") => {
      let q = admin
        .from("announcement_emails")
        .select("*", { count: "exact", head: true })
        .eq("announcement_id", id);
      if (state === "sent") q = q.not("sent_at", "is", null);
      else if (state === "pending") q = q.is("sent_at", null).is("error", null);
      else q = q.is("sent_at", null).not("error", "is", null);
      const { count: c } = await q;
      return c ?? 0;
    };
    await Promise.all(
      announcements.map(async (a: Announcement) => {
        const [sent, pending, failed] = await Promise.all([
          count(a.id, "sent"),
          count(a.id, "pending"),
          count(a.id, "failed"),
        ]);
        emailCounts.set(a.id, { sent, pending, failed });
      })
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
        <p className="text-gray-500 mt-1">Latest updates from the Hack 4 Social Good team</p>
      </div>

      {(!announcements || announcements.length === 0) && (
        <p className="text-gray-500 py-8 text-center">No announcements yet.</p>
      )}

      {announcements?.map((announcement: Announcement) => {
        const counts = emailCounts.get(announcement.id);
        const hasEmails = counts && counts.sent + counts.pending + counts.failed > 0;
        return (
          <AnnouncementCard
            key={announcement.id}
            title={announcement.title}
            content={announcement.content}
            createdAt={announcement.created_at}
          >
            {isAdmin && hasEmails && (
              <AnnouncementEmailStatus announcementId={announcement.id} {...counts} />
            )}
          </AnnouncementCard>
        );
      })}
    </div>
  );
}
