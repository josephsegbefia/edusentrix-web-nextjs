import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { requireParent } from "@/lib/auth/requireParent";
import { getParentLearnOverview } from "@/lib/learn/parent-learn-overview";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function statusText(value?: string | null) {
  if (!value) return "Not created";
  return value.replace(/_/g, " ");
}

export default async function ParentLearnCredentialsPage() {
  const ctx = await requireParent({ mode: "page" });
  const overview = await getParentLearnOverview(ctx.schoolId, ctx.userId);

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Learn credentials"
          subtitle="Guardian-scoped username and first-login status for linked wards."
          iconName="key-round"
          backHref="/parent/learn"
          backLabel="Back to Learn"
          actions={
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <Link href="/parent/learn">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Overview
              </Link>
            </Button>
          }
        />

        <GlassPanel className="p-6" glow="both">
          <p className="text-sm leading-6 text-white/60">
            Temporary passwords are not displayed here because they are not stored in plain text.
            If a ward needs access restored, request a reset from the school admin Learn account
            screen once reset actions are enabled.
          </p>
          <div className="mt-5 grid gap-3">
            {overview.wards.length ? (
              overview.wards.map((ward) => (
                <div
                  key={ward.studentId}
                  className={cn(
                    glassInsetClass,
                    "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  )}
                >
                  <div>
                    <p className="font-semibold text-white">{ward.name}</p>
                    <p className="mt-1 text-sm text-white/50">
                      {[ward.gradeName, ward.classGroupName].filter(Boolean).join(" - ")}
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p className="text-white">
                      {ward.account?.username || "No Learn account yet"}
                    </p>
                    <p className="mt-1 capitalize text-white/50">
                      {statusText(ward.account?.status)}
                      {ward.account?.mustChangePassword ? " - first login pending" : ""}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                No linked wards found.
              </p>
            )}
          </div>
        </GlassPanel>
      </WorkspacePageShell>
    </div>
  );
}
