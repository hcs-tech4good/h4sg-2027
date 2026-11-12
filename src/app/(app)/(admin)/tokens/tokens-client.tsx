"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
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
import type { InviteToken } from "@/types/database";

export function TokensClient() {
  const supabase = createClient();
  const [tokens, setTokens] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [role, setRole] = useState<"reviewer" | "admin">("reviewer");
  const [hours, setHours] = useState("24");
  const [consumable, setConsumable] = useState(true);

  useEffect(() => {
    loadTokens();
  }, []);

  async function loadTokens() {
    const { data } = await supabase
      .from("invite_tokens")
      .select("*")
      .order("created_at", { ascending: false });
    setTokens((data as InviteToken[]) || []);
    setLoading(false);
  }

  async function handleCreate() {
    setCreating(true);
    const expiresAt = new Date(
      Date.now() + parseInt(hours) * 60 * 60 * 1000
    ).toISOString();

    await supabase.from("invite_tokens").insert({
      role,
      expires_at: expiresAt,
      consumable,
    });

    await loadTokens();
    setCreating(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("invite_tokens").delete().eq("id", id);
    await loadTokens();
  }

  function getSignupUrl(tokenId: string) {
    return `${window.location.origin}/signup?token=${tokenId}`;
  }

  function copyUrl(tokenId: string) {
    navigator.clipboard.writeText(getSignupUrl(tokenId));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invite Tokens</h1>
        <p className="text-gray-500 mt-1">
          Create tokens to invite new staff members
        </p>
      </div>

      {/* Create Token */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <div className="space-y-2">
              <Label>Expires in (hours)</Label>
              <Input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                min="1"
                max="168"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create Token"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tokens List */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">Loading...</TableCell>
              </TableRow>
            ) : tokens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                  No tokens created yet
                </TableCell>
              </TableRow>
            ) : (
              tokens.map((token) => {
                const expired = new Date(token.expires_at) < new Date();
                const consumed = token.consumable && token.consumers.length > 0;
                return (
                  <TableRow key={token.id}>
                    <TableCell>
                      <Badge variant="outline">{token.role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(token.expires_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {token.consumers.length} use(s)
                    </TableCell>
                    <TableCell>
                      {expired ? (
                        <Badge variant="secondary">Expired</Badge>
                      ) : consumed ? (
                        <Badge variant="secondary">Used</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyUrl(token.id)}
                      >
                        Copy URL
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(token.id)}
                        className="text-red-600"
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
