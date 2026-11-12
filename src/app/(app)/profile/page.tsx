"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { friendlyAuthError, normalizeEmail } from "@/lib/auth-errors";
import { deleteUserAccount } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Section = "hhid" | "name" | "email" | "password" | "delete";
type Status = { kind: "saving" | "success" | "error"; message: string };

// Result message shown right beside the button that triggered it.
function InlineStatus({ status }: { status?: Status }) {
  if (!status || status.kind === "saving") return null;
  const ok = status.kind === "success";
  return (
    <p role={ok ? "status" : "alert"} className={`flex items-start gap-1.5 text-sm ${ok ? "text-green-700" : "text-red-700"}`}>
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
      {status.message}
    </p>
  );
}

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<{
    first_name: string;
    last_name: string;
    hhid: string;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [statuses, setStatuses] = useState<Partial<Record<Section, Status>>>({});
  const [loading, setLoading] = useState(true);
  const clearTimers = useRef<Partial<Record<Section, ReturnType<typeof setTimeout>>>>({});

  function setStatus(section: Section, kind: Status["kind"], message = "") {
    clearTimeout(clearTimers.current[section]);
    setStatuses((all) => ({ ...all, [section]: { kind, message } }));
    // Success messages fade after a few seconds; errors stay until the next attempt.
    if (kind === "success") {
      clearTimers.current[section] = setTimeout(
        () => setStatuses((all) => ({ ...all, [section]: undefined })),
        6000,
      );
    }
  }
  const busy = (section: Section) => statuses[section]?.kind === "saving";
  const SESSION_EXPIRED = "Your session has expired. Please refresh the page and sign in again.";

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, hhid")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const first = profile.first_name.trim(), last = profile.last_name.trim();
    if (!first || !last) return setStatus("name", "error", "Please enter both a first and last name.");
    setStatus("name", "saving");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setStatus("name", "error", SESSION_EXPIRED);

    // .select() returns the updated row, so a silently blocked update (0 rows) is caught.
    const { data, error } = await supabase
      .from("profiles")
      .update({ first_name: first, last_name: last })
      .eq("id", user.id)
      .select("id");

    if (error || !data?.length) return setStatus("name", "error", "Couldn't update your name. Please try again.");
    setProfile((p) => (p ? { ...p, first_name: first, last_name: last } : p));
    setStatus("name", "success", "Name updated.");
    router.refresh();
  }

  async function handleUpdateEmail(e: React.FormEvent) {
    e.preventDefault();
    const target = normalizeEmail(newEmail);
    if (!target) return setStatus("email", "error", "Enter a new email address.");
    if (target === normalizeEmail(email)) return setStatus("email", "error", "That's already your current email.");
    setStatus("email", "saving");

    const { error } = await supabase.auth.updateUser({ email: target });
    if (error) {
      const taken = error.code === "email_exists" || error.code === "user_already_exists";
      return setStatus("email", "error", taken ? "Another account already uses this email." : friendlyAuthError(error));
    }
    setStatus("email", "success", `Confirmation link sent to ${target}. Your email changes once you click it.`);
    setNewEmail("");
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) return setStatus("password", "error", "Password must be at least 6 characters.");
    setStatus("password", "saving");

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return setStatus("password", "error", friendlyAuthError(error));
    setStatus("password", "success", "Password updated.");
    setNewPassword("");
  }

  async function handleDeleteAccount() {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    setStatus("delete", "saving");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setStatus("delete", "error", SESSION_EXPIRED);

    try {
      await deleteUserAccount(user.id);
      await supabase.auth.signOut();
      window.location.href = "/signin";
    } catch {
      setStatus("delete", "error", "Failed to delete account. Please contact operations@t4sg.dev.");
    }
  }

  async function copyHackerId() {
    if (!profile?.hhid) return;
    try {
      await navigator.clipboard.writeText(profile.hhid);
      setStatus("hhid", "success", "Copied to clipboard.");
    } catch {
      setStatus("hhid", "error", "Couldn't copy automatically. Select the ID and copy it manually.");
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  const qrUrl = profile?.hhid
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(profile.hhid)}`
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 mt-1">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Hacker ID</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div>
            <p className="font-mono text-xl font-bold">{profile?.hhid}</p>
            <p className="text-sm text-gray-500 mt-1">Your unique Hack 4 Social Good identifier</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={copyHackerId}>
                Copy Hacker ID
              </Button>
              <InlineStatus status={statuses.hhid} />
            </div>
          </div>
          {qrUrl && (
            <img
              src={qrUrl}
              alt={`QR Code for ${profile?.hhid}`}
              className="h-28 w-28 rounded-md border"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Name</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateName} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={profile?.first_name || ""}
                  onChange={(e) =>
                    setProfile((p) => p ? { ...p, first_name: e.target.value } : p)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={profile?.last_name || ""}
                  onChange={(e) =>
                    setProfile((p) => p ? { ...p, last_name: e.target.value } : p)
                  }
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy("name")}>{busy("name") ? "Saving…" : "Update Name"}</Button>
              <InlineStatus status={statuses.name} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">Current: {email}</p>
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div className="space-y-2">
              <Label>New Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy("email")}>{busy("email") ? "Sending…" : "Change Email"}</Button>
              <InlineStatus status={statuses.email} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy("password")}>{busy("password") ? "Saving…" : "Update Password"}</Button>
              <InlineStatus status={statuses.password} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Permanently delete your account and all associated data.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={busy("delete")}>
              {busy("delete") ? "Deleting…" : "Delete Account"}
            </Button>
            <InlineStatus status={statuses.delete} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
