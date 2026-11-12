import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import { DecisionsManager } from "@/components/decisions-manager";
import { emailConfigured } from "@/lib/email";

export default async function DecisionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "reviewer")) {
    redirect("/dashboard");
  }

  // Loads every decision with the given released state, in pages (Supabase
  // caps a query at 1000 rows) and with chunked id lookups (URL length).
  async function loadDecisions(released: boolean) {
    const PAGE = 1000;
    const rows: { id: string; type: string; decided_at: string }[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data } = await admin
        .from("decisions")
        .select("id, type, decided_at")
        .eq("released", released)
        .order("decided_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (data) rows.push(...data);
      if (!data || data.length < PAGE) break;
    }
    const ids = rows.map((r) => r.id);

    const CHUNK = 200;
    const profileRows: { id: string; first_name: string; last_name: string; hhid: string }[] = [];
    const appRows: { id: string; email: string }[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const [{ data: p }, { data: a }] = await Promise.all([
        admin.from("profiles").select("id, first_name, last_name, hhid").in("id", slice),
        admin.from("applications").select("id, email").in("id", slice),
      ]);
      if (p) profileRows.push(...p);
      if (a) appRows.push(...a);
    }

    const profileById = new Map(profileRows.map((p) => [p.id, p]));
    const emailById = new Map(appRows.map((a) => [a.id, a.email]));

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      decided_at: r.decided_at,
      profiles: profileById.get(r.id) ?? { first_name: "", last_name: "", hhid: "" },
      applications: { email: emailById.get(r.id) ?? "" },
    }));
  }

  const [stagedDecisions, releasedDecisions] = await Promise.all([
    loadDecisions(false),
    loadDecisions(true),
  ]);

  const { data: recentReleases } = await admin
    .from("decision_releases")
    .select("*")
    .order("released_at", { ascending: false })
    .limit(10);

  const [{ count: pendingEmails }, { count: failedEmails }] = await Promise.all([
    admin
      .from("decisions")
      .select("*", { count: "exact", head: true })
      .eq("released", true)
      .is("notified_at", null)
      .is("notify_error", null),
    admin
      .from("decisions")
      .select("*", { count: "exact", head: true })
      .eq("released", true)
      .is("notified_at", null)
      .not("notify_error", "is", null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Decisions</h1>
        <p className="text-gray-500 mt-1">
          Staged decisions are not visible to hackers until released. Released decisions can still be changed.
        </p>
      </div>
      <DecisionsManager
        stagedDecisions={stagedDecisions}
        releasedDecisions={releasedDecisions}
        recentReleases={recentReleases || []}
        emailStatus={{
          configured: emailConfigured(),
          pending: pendingEmails ?? 0,
          failed: failedEmails ?? 0,
        }}
      />
    </div>
  );
}
