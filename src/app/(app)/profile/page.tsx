"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { deleteUserAccount } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<{
    first_name: string;
    last_name: string;
    hhid: string;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

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
    setError("");
    setSuccess("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ first_name: profile.first_name, last_name: profile.last_name })
      .eq("id", user.id);

    if (error) setError("Failed to update name");
    else setSuccess("Name updated successfully");
  }

  async function handleUpdateEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newEmail || newEmail === email) {
      setError("Enter a new email address");
      return;
    }

    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) setError(error.message);
    else {
      setSuccess(
        "A confirmation link has been sent to your new email. The change takes effect once confirmed."
      );
      setNewEmail("");
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setError(error.message);
    else {
      setSuccess("Password updated successfully");
      setNewPassword("");
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await deleteUserAccount(user.id);
      await supabase.auth.signOut();
      window.location.href = "/signin";
    } catch {
      setError("Failed to delete account. Please contact support.");
    }
  }

  function copyHackerId() {
    if (profile?.hhid) {
      navigator.clipboard.writeText(profile.hhid);
      setSuccess("Hacker ID copied to clipboard");
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

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Hacker ID</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div>
            <p className="font-mono text-xl font-bold">{profile?.hhid}</p>
            <p className="text-sm text-gray-500 mt-1">Your unique Hack 4 Social Good identifier</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={copyHackerId}>
              Copy Hacker ID
            </Button>
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
            <Button type="submit">Update Name</Button>
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
            <Button type="submit">Change Email</Button>
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
            <Button type="submit">Update Password</Button>
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
          <Button variant="destructive" onClick={handleDeleteAccount}>
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
