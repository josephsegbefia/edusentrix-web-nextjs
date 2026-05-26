import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { requireParent } from "@/lib/auth/requireParent";
import { getParentLearnOverview } from "@/lib/learn/parent-learn-overview";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function shortDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function ParentLearnPaymentsPage() {
  const ctx = await requireParent({ mode: "page" });
  const overview = await getParentLearnOverview(ctx.schoolId, ctx.userId);

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Learn payments"
          subtitle="EduSentrix Learn payment status, separate from school fee invoices and balances."
          iconName="credit-card"
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

        <GlassPanel className="p-6" glow="teal">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
                Current term price
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {money(overview.pricePerStudentPerTermMinor, overview.currency)}
              </p>
            </div>
            <p className="max-w-xl text-sm leading-6 text-white/60">
              Parents pay EduSentrix Learn directly to EduSentrix/Appsentrix. These records do not
              create school fee invoices or bursar reconciliation items.
            </p>
          </div>
        </GlassPanel>

        <div className="grid gap-4">
          {overview.wards.length ? (
            overview.wards.map((ward) => (
              <GlassPanel key={ward.studentId} className="p-5" glow="cyan">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-white">{ward.name}</p>
                    <p className="mt-1 text-sm text-white/50">
                      Active access:{" "}
                      {ward.access ? `until ${shortDate(ward.access.expiresAt)}` : "No"}
                    </p>
                  </div>
                  <div className={cn(glassInsetClass, "p-4 text-sm md:min-w-64")}>
                    {ward.latestPayment ? (
                      <>
                        <p className="font-medium capitalize text-white">
                          {ward.latestPayment.status.replace(/_/g, " ")}
                        </p>
                        <p className="mt-1 text-white/55">
                          {money(ward.latestPayment.amountMinor, ward.latestPayment.currency)} on{" "}
                          {shortDate(ward.latestPayment.createdAt)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-white">No Learn payment yet</p>
                        <p className="mt-1 text-white/55">
                          This does not affect school fee balances.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </GlassPanel>
            ))
          ) : (
            <GlassPanel className="p-8 text-center" glow="cyan">
              <p className="font-medium text-white">No linked wards found.</p>
            </GlassPanel>
          )}
        </div>
      </WorkspacePageShell>
    </div>
  );
}
