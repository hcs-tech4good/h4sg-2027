import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { TokensClient } from "./tokens-client";

export default async function TokensPage() {
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

  return <TokensClient />;
}
