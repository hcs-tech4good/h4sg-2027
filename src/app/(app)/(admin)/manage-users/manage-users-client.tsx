"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { setUserRole, promoteUserByEmail } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Profile } from "@/types/database";

export function ManageUsersClient() {
  const supabase = createClient();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"reviewer" | "admin">("reviewer");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["admin", "reviewer"])
      .order("created_at", { ascending: false });
    setStaff((data as Profile[]) || []);
    setLoading(false);
  }

  async function handlePromote(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setPromoting(true);

    try {
      await promoteUserByEmail(email, role);
      setSuccess(`${email} has been promoted to ${role}`);
      setEmail("");
      await loadStaff();
    } catch {
      setError("Failed to promote user. Please try again.");
    }
    setPromoting(false);
  }

  async function handleDemote(id: string) {
    await setUserRole(id, "applicant");
    await loadStaff();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage Users</h1>
        <p className="text-gray-500 mt-1">
          Assign admin or reviewer roles to users by email
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promote User</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePromote} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}
            {success && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>User Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole((v || "reviewer") as "reviewer" | "admin")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={promoting}>
                  {promoting ? "Promoting..." : "Promote"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Hacker ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6">Loading...</TableCell>
              </TableRow>
            ) : staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                  No staff members yet
                </TableCell>
              </TableRow>
            ) : (
              staff.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.first_name} {user.last_name}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{user.hhid}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDemote(user.id)}
                      className="text-red-600"
                    >
                      Demote
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
