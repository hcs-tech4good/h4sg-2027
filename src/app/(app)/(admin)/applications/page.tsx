import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import { ApplicationsTable } from "@/components/applications-table";
import { ResumeDownload } from "@/components/resume-download";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

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

  const page = Math.max(1, parseInt(params.page || "1"));
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  // Sanitize search to safe characters (prevents breaking the PostgREST .or grammar).
  const search = (params.search || "").replace(/[^a-zA-Z0-9 @._-]/g, "").trim();

  let query = admin
    .from("applications")
    .select(
      "id, email, age, school, major, submitted_at, underrepresented, harvard_affiliated, h4sg_details",
      { count: "exact" }
    )
    .eq("submitted", true)
    .order("submitted_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (search) {
    query = query.or(
      `email.ilike.%${search}%,school.ilike.%${search}%,major.ilike.%${search}%`
    );
  }

  const { data: apps, count } = await query;
  const rows = apps || [];
  const ids = rows.map((r) => r.id);

  // Join profiles + decisions for this page only (no PostgREST embedding —
  // applications/profiles/decisions share a FK to auth.users, not to each other).
  const [{ data: profiles }, { data: decisions }] = await Promise.all([
    ids.length
      ? admin.from("profiles").select("id, first_name, last_name, hhid").in("id", ids)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; hhid: string }[] }),
    ids.length
      ? admin.from("decisions").select("id, type, released").in("id", ids)
      : Promise.resolve({ data: [] as { id: string; type: string; released: boolean }[] }),
  ]);

  const profileById = new Map((profiles || []).map((p) => [p.id, p]));
  const decisionById = new Map((decisions || []).map((d) => [d.id, d]));

  const applications = rows.map((r) => ({
    ...r,
    profiles: profileById.get(r.id) || { first_name: "", last_name: "", hhid: "" },
    decisions: decisionById.get(r.id) || null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <p className="text-gray-500 mt-1">
          Review and manage submitted applications
        </p>
      </div>
      {profile.role === "admin" && <ResumeDownload />}
      <ApplicationsTable
        applications={applications}
        totalCount={count || 0}
        currentPage={page}
        pageSize={pageSize}
      />
    </div>
  );
}
