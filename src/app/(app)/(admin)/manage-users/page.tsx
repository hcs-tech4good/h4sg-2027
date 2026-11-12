import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { ManageUsersClient } from "./manage-users-client";

export default async function ManageUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return <ManageUsersClient />;
}
