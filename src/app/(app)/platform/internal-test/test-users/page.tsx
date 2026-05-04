"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { PHRASE_DELETE_ALL_TEST_USERS } from "@/lib/internal-test/constants";

type Row = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  schoolId: string | null;
  schoolName: string | null;
  testUserSource: string | null;
  hasClerk: boolean;
  createdAt: string | null;
};

export default function PlatformInternalTestUsersPage() {
  const [loading, setLoading] = React.useState(true);
  const [toolsDisabled, setToolsDisabled] = React.useState(false);
  const [items, setItems] = React.useState<Row[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [schoolFilter, setSchoolFilter] = React.useState("");
  const [appliedSchoolId, setAppliedSchoolId] = React.useState("");

  const [deleteScope, setDeleteScope] = React.useState<"ids" | "school" | "all">("ids");
  const [deleteUserIds, setDeleteUserIds] = React.useState("");
  const [deleteSchoolId, setDeleteSchoolId] = React.useState("");
  const [deletePhrase, setDeletePhrase] = React.useState("");
  const [deleteSecret, setDeleteSecret] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setToolsDisabled(false);
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("limit", "50");
      if (appliedSchoolId.trim()) qs.set("schoolId", appliedSchoolId.trim());
      const res = await fetch(`/api/platform/internal-test/test-users?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        if (json?.code === "INTERNAL_TEST_TOOLS_DISABLED") {
          setToolsDisabled(true);
          setItems([]);
          setTotal(0);
          return;
        }
        throw new Error(json?.error || "Failed to load");
      }
      setItems((json.data?.items as Row[]) ?? []);
      setTotal(Number(json.data?.total) || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, appliedSchoolId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function runDelete() {
    try {
      setDeleting(true);
      const userIds =
        deleteScope === "ids"
          ? deleteUserIds
              .split(/[\s,]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;
      const res = await fetch("/api/platform/internal-test/test-users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationPhrase: deletePhrase.trim(),
          activationSecret: deleteSecret.trim(),
          scope: deleteScope,
          schoolId: deleteScope === "school" ? deleteSchoolId.trim() : undefined,
          userIds,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Delete failed");
      }
      const deleted = json.data?.deleted ?? 0;
      const attempted = json.data?.attempted ?? 0;
      toast.success(`Deleted ${deleted} of ${attempted} test user(s).`);
      setDeletePhrase("");
      setDeleteSecret("");
      setDeleteUserIds("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 p-2 md:p-4">
      <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-white/70 hover:text-white">
        <Link href="/platform/schools">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to schools
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Synthetic test users</h1>
        <p className="mt-1 text-sm text-white/60">
          Users with <code className="rounded bg-white/10 px-1">isTestUser</code> across all schools (e.g.{" "}
          <code className="rounded bg-white/10 px-1">@edusentrix.app</code> QA accounts).
        </p>
      </div>

      {toolsDisabled ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-6 text-sm text-white/70">
            Internal test tools are disabled in this environment (
            <code className="rounded bg-black/30 px-1">ENABLE_INTERNAL_TEST_TOOLS</code>).
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-white">Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label className="text-white/70">School ID (optional)</Label>
            <Input
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              placeholder="24-hex Mongo id"
              className="min-w-[260px] border-white/10 bg-black/35 font-mono text-sm text-white"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="bg-white/10 text-white hover:bg-white/15"
            onClick={() => {
              setAppliedSchoolId(schoolFilter.trim());
              setPage(1);
            }}
          >
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-white/70"
            onClick={() => {
              setSchoolFilter("");
              setAppliedSchoolId("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base text-white">
            Directory{" "}
            {!loading ? (
              <span className="text-sm font-normal text-white/45">({total} total)</span>
            ) : null}
          </CardTitle>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-white/50" /> : null}
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm text-white/85">
            <thead className="border-b border-white/10 bg-black/25 text-xs uppercase text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Clerk</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/3">
                  <td className="px-4 py-2 font-mono text-xs text-brand">{u.email}</td>
                  <td className="px-4 py-2 text-white/80">
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-2 text-white/70">{u.role ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-white/60">
                    {u.schoolName ? (
                      <span title={u.schoolId ?? ""}>{u.schoolName}</span>
                    ) : (
                      u.schoolId ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-white/50">{u.hasClerk ? "yes" : "no"}</td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-white/45">
                    No test users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {total > 50 ? (
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-white/55">
              <span>
                Page {page} of {Math.max(1, Math.ceil(total / 50))}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1 || loading}
                  className="bg-white/10 text-white"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={page >= Math.ceil(total / 50) || loading}
                  className="bg-white/10 text-white"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-rose-500/25 bg-linear-to-br from-rose-950/40 via-slate-950 to-black">
        <CardHeader>
          <CardTitle className="text-lg text-rose-100">Delete test users</CardTitle>
          <p className="text-sm text-rose-100/75">
            Removes Mongo users marked <code className="rounded bg-black/35 px-1">isTestUser</code>, unlinks
            related records, deletes Clerk accounts when present, and attempts to remove avatar files from URLs.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/80">Scope</Label>
            <PremiumSelect
              value={deleteScope}
              onValueChange={(v) => setDeleteScope(v as typeof deleteScope)}
            >
              <PremiumSelectTrigger className="border-white/10 bg-black/40 text-white">
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="ids">Specific user IDs</PremiumSelectItem>
                <PremiumSelectItem value="school">All test users in one school</PremiumSelectItem>
                <PremiumSelectItem value="all">All test users (entire deployment)</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          {deleteScope === "ids" ? (
            <div className="space-y-2">
              <Label className="text-white/80">User IDs (comma or space separated)</Label>
              <textarea
                value={deleteUserIds}
                onChange={(e) => setDeleteUserIds(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-white/10 bg-black/40 p-2 font-mono text-xs text-white placeholder:text-white/30"
                placeholder="64d2… 64d3…"
              />
            </div>
          ) : null}

          {deleteScope === "school" ? (
            <div className="space-y-2">
              <Label className="text-white/80">School ID</Label>
              <Input
                value={deleteSchoolId}
                onChange={(e) => setDeleteSchoolId(e.target.value)}
                className="border-white/10 bg-black/40 font-mono text-sm text-white"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-white/80">Confirmation phrase</Label>
            <Input
              value={deletePhrase}
              onChange={(e) => setDeletePhrase(e.target.value)}
              placeholder={PHRASE_DELETE_ALL_TEST_USERS}
              className="border-rose-500/20 bg-black/40 font-mono text-sm text-white"
              autoComplete="off"
            />
            <p className="text-xs text-rose-100/70">
              Type exactly: <code className="rounded bg-black/35 px-1">{PHRASE_DELETE_ALL_TEST_USERS}</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">Activation secret</Label>
            <Input
              type="password"
              value={deleteSecret}
              onChange={(e) => setDeleteSecret(e.target.value)}
              className="border-rose-500/20 bg-black/40 font-mono text-sm text-white"
              autoComplete="off"
            />
          </div>

          <Button
            type="button"
            variant="destructive"
            disabled={deleting || !deletePhrase.trim() || !deleteSecret.trim()}
            className="gap-2"
            onClick={() => void runDelete()}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
