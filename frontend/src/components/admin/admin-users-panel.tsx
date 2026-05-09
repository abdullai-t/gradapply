"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserRole = "USER" | "ADMIN" | "SUPERADMIN";
type PlanTier = "FREE" | "PLUS" | "PRO";

type AdminUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  planTier: PlanTier;
  subscriptionStatus: string | null;
  aiUsageUsed: number;
  aiCreditsBalance: number;
  createdAt: string;
  hasStripeCustomer: boolean;
  hasPaystackCustomer: boolean;
};

type AdminUsersResponse = {
  page: number;
  pageSize: number;
  total: number;
  actorRole: "ADMIN" | "SUPERADMIN";
  users: AdminUserRow[];
};

const roleChoices: UserRole[] = ["USER", "ADMIN", "SUPERADMIN"];
const tierChoices: PlanTier[] = ["FREE", "PLUS", "PRO"];

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formRole, setFormRole] = useState<UserRole>("USER");
  const [formTier, setFormTier] = useState<PlanTier>("FREE");
  const [formStatus, setFormStatus] = useState("");
  const [formCreditsDelta, setFormCreditsDelta] = useState("0");
  const [formResetUsage, setFormResetUsage] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const pageCount = useMemo(() => {
    if (!users) return 1;
    return Math.max(1, Math.ceil(users.total / users.pageSize));
  }, [users]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (roleFilter !== "ALL") params.set("role", roleFilter);
    params.set("page", String(page));
    const res = await fetch(`/api/admin/users?${params.toString()}`, {
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as
      | AdminUsersResponse
      | { error?: string }
      | null;
    if (!res.ok || !data || isErrorPayload(data)) {
      setError(
        data && isErrorPayload(data) ? data.error ?? "Load failed" : "Load failed",
      );
      setLoadingUsers(false);
      return;
    }
    setUsers(data);
    setLoadingUsers(false);
  }, [page, roleFilter, search]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const openEdit = (user: AdminUserRow) => {
    setEditing(user);
    setFormRole(user.role);
    setFormTier(user.planTier);
    setFormStatus(user.subscriptionStatus ?? "");
    setFormCreditsDelta("0");
    setFormResetUsage(false);
  };

  const canManageRoles =
    users?.actorRole === "ADMIN" || users?.actorRole === "SUPERADMIN";

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const creditsDeltaNum = Number(formCreditsDelta);
    const payload: {
      role?: UserRole;
      planTier?: PlanTier;
      subscriptionStatus?: string | null;
      aiCreditsDelta?: number;
      resetMonthlyUsage?: boolean;
    } = {
      planTier: formTier,
      subscriptionStatus: formStatus.trim() ? formStatus.trim() : null,
      resetMonthlyUsage: formResetUsage,
    };
    if (canManageRoles) payload.role = formRole;
    if (Number.isFinite(creditsDeltaNum) && creditsDeltaNum !== 0) {
      payload.aiCreditsDelta = Math.trunc(creditsDeltaNum);
    }

    const res = await fetch(`/api/admin/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!res.ok) {
      setError(json?.error ?? "Could not save user.");
      setSaving(false);
      return;
    }

    await loadUsers();
    setSaving(false);
    setEditing(null);
  };

  const deleteUser = async () => {
    if (!editing) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${editing.id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!res.ok) {
      setError(json?.error ?? "Delete failed.");
      setDeleting(false);
      return;
    }
    await loadUsers();
    setDeleting(false);
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">User management</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Adjust plans, quotas, and roles with safeguards for superadmin actions.
        </p>
        {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}
      </div>

      <div className="glass-panel p-5">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              className="pl-9"
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as "ALL" | UserRole)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Role filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              {roleChoices.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            onClick={() => {
              setPage(1);
              void loadUsers();
            }}
            disabled={loadingUsers}
          >
            Apply
          </Button>
        </div>

        {loadingUsers || !users ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading users...
          </div>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Subscription</th>
                    <th className="px-3 py-2">Usage</th>
                    <th className="px-3 py-2">Credits</th>
                    <th className="px-3 py-2">Billing IDs</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.users.map((u) => (
                    <tr key={u.id} className="border-b border-white/[0.06]">
                      <td className="px-3 py-2">
                        <p className="font-medium">{u.name?.trim() || u.email || "Unnamed user"}</p>
                        <p className="text-xs text-muted-foreground">{u.email ?? "No email"}</p>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{u.role}</Badge>
                      </td>
                      <td className="px-3 py-2">{u.planTier}</td>
                      <td className="px-3 py-2">{u.subscriptionStatus ?? "—"}</td>
                      <td className="px-3 py-2">{u.aiUsageUsed}</td>
                      <td className="px-3 py-2">{u.aiCreditsBalance}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        <div>Stripe: {u.hasStripeCustomer ? "yes" : "no"}</div>
                        <div>Paystack: {u.hasPaystackCustomer ? "yes" : "no"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Showing {(users.page - 1) * users.pageSize + 1}-
                {Math.min(users.page * users.pageSize, users.total)} of {users.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={users.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="text-muted-foreground">
                  Page {users.page} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={users.page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage user</DialogTitle>
            <DialogDescription>
              {editing?.email ?? editing?.name ?? "Selected user"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Plan tier
              </label>
              <Select value={formTier} onValueChange={(v) => setFormTier(v as PlanTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tierChoices.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canManageRoles ? (
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Role
                </label>
                <Select value={formRole} onValueChange={(v) => setFormRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleChoices.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Subscription status
              </label>
              <Input
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                placeholder="active, trialing, past_due, ... (empty clears)"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Credit adjustment
              </label>
              <Input
                value={formCreditsDelta}
                onChange={(e) => setFormCreditsDelta(e.target.value)}
                placeholder="0"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formResetUsage}
                onChange={(e) => setFormResetUsage(e.target.checked)}
              />
              Reset monthly AI usage counter to 0
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => void deleteUser()}
              disabled={!canManageRoles || deleting || saving}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete user
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} disabled={saving || deleting}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isErrorPayload(
  value: AdminUsersResponse | { error?: string },
): value is { error?: string } {
  return "error" in value;
}
