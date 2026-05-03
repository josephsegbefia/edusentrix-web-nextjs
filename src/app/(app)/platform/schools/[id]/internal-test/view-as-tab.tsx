"use client";

import * as React from "react";
import { Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type TestUserRow = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  testUserSource?: string | null;
};

export function InternalTestViewAsTab({
  schoolId,
  allowImpersonation,
}: {
  schoolId: string;
  allowImpersonation: boolean;
}) {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<TestUserRow[]>([]);
  const [actingId, setActingId] = React.useState<string | null>(null);
  const [roleFilter, setRoleFilter] = React.useState<string>("__all__");

  const roleOptions = React.useMemo(() => {
    const set = new Set(items.map((u) => u.role).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visibleItems = React.useMemo(() => {
    if (roleFilter === "__all__") return items;
    return items.filter((u) => u.role === roleFilter);
  }, [items, roleFilter]);

  const load = React.useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/platform/schools/${schoolId}/internal-test/test-users`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load test users");
      }
      setItems((json.data?.items as TestUserRow[]) ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => {
    if (allowImpersonation) void load();
  }, [allowImpersonation, load]);

  async function startViewAs(targetUserId: string) {
    if (!schoolId) return;
    try {
      setActingId(targetUserId);
      const res = await fetch(`/api/platform/schools/${schoolId}/internal-test/impersonate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const code = json?.code;
        if (code === "IMPERSONATION_SECRET_MISSING" || code === "IMPERSONATION_DISABLED") {
          throw new Error(json?.error || "Impersonation unavailable");
        }
        throw new Error(json?.error || "Could not start view");
      }
      const path = json.data?.redirectPath as string | undefined;
      if (path) {
        window.location.assign(path);
        return;
      }
      toast.success("View started. Open a school page in another tab if you are not redirected.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start view");
    } finally {
      setActingId(null);
    }
  }

  if (!allowImpersonation) {
    return (
      <Alert className="border-white/15 bg-black/25 text-white/85">
        <UserRound className="h-4 w-4 text-white/60" />
        <AlertTitle className="text-white">Impersonation disabled</AlertTitle>
        <AlertDescription className="text-white/65">
          Turn on &quot;Allow impersonation&quot; under Safety controls, save, then return here.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/60">
        Platform admins can open the app as a marked test user. Your session shows a banner until you exit.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-white/70">Filter by role</Label>
          <PremiumSelect
            value={roleFilter}
            onValueChange={setRoleFilter}
            disabled={loading || items.length === 0}
          >
            <PremiumSelectTrigger className="w-[min(100%,220px)] border-white/10 bg-black/35 text-white">
              <PremiumSelectValue placeholder="All roles" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="__all__">All roles</PremiumSelectItem>
              {roleOptions.map((r) => (
                <PremiumSelectItem key={r} value={r}>
                  {r}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/15 bg-black/30 text-white hover:bg-white/10"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Refresh list
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-6 text-sm text-white/55">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading test users…
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-black/20 p-6 text-sm text-white/55">
          No users with <code className="rounded bg-black/40 px-1 py-0.5 text-xs">isTestUser</code> in this
          school yet. Seed or create test accounts first.
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-black/20 p-6 text-sm text-white/55">
          No test users match this role filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/75">Name</TableHead>
                <TableHead className="text-white/75">Email</TableHead>
                <TableHead className="text-white/75">Role</TableHead>
                <TableHead className="w-[120px] text-right text-white/75">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((u) => {
                const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || "—";
                return (
                  <TableRow key={u.id} className="border-white/10">
                    <TableCell className="font-medium text-white/90">{name}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-white/70">{u.email}</TableCell>
                    <TableCell className="text-white/65">{u.role}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-brand text-black hover:bg-brand/90"
                        disabled={actingId !== null}
                        onClick={() => void startViewAs(u.id)}
                      >
                        {actingId === u.id ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Opening…
                          </>
                        ) : (
                          "View as"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
