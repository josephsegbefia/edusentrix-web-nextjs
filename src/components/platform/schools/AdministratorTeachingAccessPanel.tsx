"use client";

import * as React from "react";
import { GraduationCap, Loader2, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

type Administrator = {
  userId: string;
  name: string | null;
  email: string | null;
  membershipStatus: "active" | "invited" | "suspended";
  schoolAdministrator: true;
  teachingAccessEnabled: boolean;
  teacherRoleAssigned: boolean;
  teacherProfileId: string | null;
  teacherProfileStatus: string | null;
  activeAssignmentCount: number;
};

export function AdministratorTeachingAccessPanel({ schoolId }: { schoolId: string }) {
  const searchParams = useSearchParams();
  const [administrators, setAdministrators] = React.useState<Administrator[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [visible, setVisible] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/platform/schools/${schoolId}/admins`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 403) {
        setVisible(false);
        return;
      }
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to load administrators");
      }
      setAdministrators(payload.data?.administrators || []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load administrators");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (searchParams.get("section") === "admin-access") {
      document.getElementById("administrators-access")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [searchParams, loading]);

  async function toggleAdministrator(administrator: Administrator) {
    const enabled = !administrator.teachingAccessEnabled;
    const decision = await confirm({
      title: enabled ? "Enable teaching access?" : "Disable teaching access?",
      description: enabled
        ? `${administrator.name || administrator.email || "This administrator"} will retain admin access and gain the Teacher workspace in this school.`
        : administrator.activeAssignmentCount > 0
          ? "Active teaching assignments must be reassigned before teaching access can be disabled."
          : `${administrator.name || administrator.email || "This administrator"} will keep admin access. Their Teacher workspace access will be removed, and teaching history will be preserved.`,
      confirmLabel: enabled ? "Enable teaching access" : "Disable teaching access",
      cancelLabel: "Cancel",
      intent: enabled ? "default" : "warning",
    });
    if (decision !== "confirm") return;

    try {
      setBusyUserId(administrator.userId);
      const response = await fetch(
        `/api/platform/schools/${schoolId}/admins/${administrator.userId}/teaching-access`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to update teaching access");
      }
      setAdministrators((current) =>
        current.map((row) => (row.userId === administrator.userId ? payload.data : row))
      );
      toast.success(enabled ? "Teaching access enabled." : "Teaching access disabled.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Failed to update teaching access");
    } finally {
      setBusyUserId(null);
    }
  }

  if (!visible) return null;

  return (
    <Card id="administrators-access" className="border-white/10 bg-white/5 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCog className="h-5 w-5 text-cyan-300" />
          Administrators &amp; Access
        </CardTitle>
        <p className="text-sm text-white/60">
          Give an existing school administrator a Teacher workspace without creating another account or removing admin access.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading administrators
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : administrators.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            No school administrator memberships were found.
          </div>
        ) : (
          administrators.map((administrator) => {
            const canChange = administrator.membershipStatus === "active";
            const blockedByAssignments =
              administrator.teachingAccessEnabled && administrator.activeAssignmentCount > 0;
            const busy = busyUserId === administrator.userId;
            return (
              <div
                key={administrator.userId}
                className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/20 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{administrator.name || "Unnamed administrator"}</p>
                    <Badge className="border-violet-400/25 bg-violet-400/10 text-violet-100">
                      School Administrator
                    </Badge>
                    {administrator.teachingAccessEnabled ? (
                      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-100">
                        Teacher enabled
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-white/55">{administrator.email || "No email"}</p>
                  <p className="mt-2 text-xs text-white/45">
                    Membership: {administrator.membershipStatus} · Teacher profile: {administrator.teacherProfileStatus || "not created"}
                    {administrator.activeAssignmentCount > 0
                      ? ` · ${administrator.activeAssignmentCount} active assignment${administrator.activeAssignmentCount === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canChange || busy || blockedByAssignments}
                  onClick={() => void toggleAdministrator(administrator)}
                  className={administrator.teachingAccessEnabled
                    ? "border-amber-300/30 bg-amber-300/10 text-amber-50 hover:bg-amber-300/20"
                    : "border-cyan-300/30 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/20"}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : administrator.teachingAccessEnabled ? <ShieldCheck className="mr-2 h-4 w-4" /> : <GraduationCap className="mr-2 h-4 w-4" />}
                  {administrator.teachingAccessEnabled ? "Disable teaching access" : "Enable teaching access"}
                </Button>
              </div>
            );
          })
        )}
        {confirmationDialog}
      </CardContent>
    </Card>
  );
}
