import Link from "next/link";
import { ArrowRight, AlertTriangle, Landmark, ShieldAlert, Waypoints } from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { formatMoney } from "@/lib/fees/money";
import { School } from "@/models/School";
import { ReconciliationAlert } from "@/models/ReconciliationAlert";
import { ReconciliationIngestion } from "@/models/ReconciliationIngestion";
import { ReconciliationRun } from "@/models/ReconciliationRun";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformPill,
  PlatformSection,
  formatDate,
  formatTimestamp,
} from "@/components/platform/platform-page-primitives";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<string, "cyan" | "amber" | "rose"> = {
  info: "cyan",
  warning: "amber",
  critical: "rose",
};

const RUN_STATUS_TONE: Record<string, "emerald" | "amber" | "rose"> = {
  completed: "emerald",
  running: "amber",
  failed: "rose",
};

export default async function PlatformReconciliationPage() {
  await connectToDatabase();

  const failedSince = new Date();
  failedSince.setDate(failedSince.getDate() - 14);

  const [activeAlertsCount, criticalAlertsCount, backlogCount, failedRunsCount] =
    await Promise.all([
      ReconciliationAlert.countDocuments({ status: "active" }),
      ReconciliationAlert.countDocuments({ status: "active", severity: "critical" }),
      ReconciliationIngestion.countDocuments({ status: { $in: ["unmatched", "ambiguous"] } }),
      ReconciliationRun.countDocuments({
        status: "failed",
        startedAt: { $gte: failedSince },
      }),
    ]);

  const [activeAlerts, backlogBySchool, recentRuns] = await Promise.all([
    ReconciliationAlert.find({ status: "active" })
      .sort({ lastDetectedAt: -1 })
      .limit(18)
      .select("schoolId severity title description queue count lastDetectedAt")
      .lean<
        Array<{
          _id: unknown;
          schoolId: unknown;
          severity: "info" | "warning" | "critical";
          title: string;
          description: string;
          queue?: string | null;
          count: number;
          lastDetectedAt: Date;
        }>
      >(),
    ReconciliationIngestion.aggregate<{
      _id: unknown;
      unmatched: number;
      ambiguous: number;
      items: number;
      totalAmountMinor: number;
      latestTransactionDate: Date | null;
    }>([
      {
        $match: {
          status: { $in: ["unmatched", "ambiguous"] },
        },
      },
      {
        $group: {
          _id: "$schoolId",
          items: { $sum: 1 },
          unmatched: {
            $sum: {
              $cond: [{ $eq: ["$status", "unmatched"] }, 1, 0],
            },
          },
          ambiguous: {
            $sum: {
              $cond: [{ $eq: ["$status", "ambiguous"] }, 1, 0],
            },
          },
          totalAmountMinor: { $sum: "$amountMinor" },
          latestTransactionDate: { $max: "$transactionDate" },
        },
      },
      { $sort: { items: -1, unmatched: -1, latestTransactionDate: -1 } },
      { $limit: 12 },
    ]),
    ReconciliationRun.find({})
      .sort({ startedAt: -1 })
      .limit(18)
      .select("schoolId mode status startedAt completedAt summary errorMessage")
      .lean<
        Array<{
          _id: unknown;
          schoolId: unknown;
          mode: "manual" | "scheduled";
          status: "running" | "completed" | "failed";
          startedAt: Date;
          completedAt?: Date | null;
          errorMessage?: string | null;
          summary: {
            inspectedIngestion: number;
            matched: number;
            ambiguous: number;
            staleEscalated: number;
            errors: number;
          };
        }>
      >(),
  ]);

  const schoolIds = Array.from(
    new Set([
      ...activeAlerts.map((alert) => String(alert.schoolId)),
      ...backlogBySchool.map((row) => String(row._id)),
      ...recentRuns.map((run) => String(run.schoolId)),
    ])
  );

  const schools = schoolIds.length
    ? await School.find({ _id: { $in: schoolIds } })
        .select("name")
        .lean<Array<{ _id: unknown; name: string }>>()
    : [];

  const schoolMap = new Map(schools.map((school) => [String(school._id), school.name]));

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Finance Operations"
        title="Cross-school reconciliation queue"
        description="Track unresolved alerts, inspect the schools carrying the heaviest queue load, and confirm whether recent reconciliation runs are keeping up."
        actions={
          <>
            <Link
              href="/platform/billing"
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span>Billing Command Center</span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
            <Link
              href="/platform/audit"
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span>Audit Trail</span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
          </>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={ShieldAlert}
          label="Active Alerts"
          value={activeAlertsCount.toLocaleString()}
          note="Unresolved reconciliation alerts across all schools."
          tone="amber"
        />
        <PlatformMetricCard
          icon={AlertTriangle}
          label="Critical Alerts"
          value={criticalAlertsCount.toLocaleString()}
          note="Alerts currently marked critical and needing immediate attention."
          tone="rose"
        />
        <PlatformMetricCard
          icon={Waypoints}
          label="Queue Items"
          value={backlogCount.toLocaleString()}
          note="Unmatched or ambiguous ingestion rows still awaiting disposition."
          tone="cyan"
        />
        <PlatformMetricCard
          icon={Landmark}
          label="Failed Runs"
          value={failedRunsCount.toLocaleString()}
          note="Run failures captured in the last 14 days."
          tone="violet"
        />
      </PlatformMetricGrid>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <PlatformSection
          title="Active Alert Stream"
          description="The newest unresolved alerts with school context and queue hints."
        >
          <div className="space-y-3">
            {activeAlerts.length > 0 ? (
              activeAlerts.map((alert) => (
                <div
                  key={String(alert._id)}
                  className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{alert.title}</p>
                      <p className="mt-1 text-sm text-white/55">{alert.description}</p>
                      <p className="mt-2 text-xs text-white/40">
                        {schoolMap.get(String(alert.schoolId)) || "Unknown school"}
                        {alert.queue ? ` • ${alert.queue}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <PlatformPill tone={SEVERITY_TONE[alert.severity]}>
                        {alert.severity}
                      </PlatformPill>
                      <PlatformPill tone="slate">{alert.count.toLocaleString()} items</PlatformPill>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-white/35">
                    Last detected {formatTimestamp(alert.lastDetectedAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/45">No active reconciliation alerts right now.</p>
            )}
          </div>
        </PlatformSection>

        <PlatformSection
          title="Backlog By School"
          description="Schools with the largest unresolved reconciliation workload."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/45">
                  <th className="pb-3 font-medium">School</th>
                  <th className="pb-3 font-medium">Items</th>
                  <th className="pb-3 font-medium">Mix</th>
                  <th className="pb-3 font-medium">Exposure</th>
                  <th className="pb-3 font-medium">Latest</th>
                </tr>
              </thead>
              <tbody>
                {backlogBySchool.map((row) => (
                  <tr key={String(row._id)} className="border-b border-white/5">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/platform/schools/${String(row._id)}`}
                        className="font-medium text-white transition-colors hover:text-cyan-200"
                      >
                        {schoolMap.get(String(row._id)) || "Unknown school"}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-white">{row.items.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-white/60">
                      {row.unmatched.toLocaleString()} unmatched
                      <span className="text-white/25"> / </span>
                      {row.ambiguous.toLocaleString()} ambiguous
                    </td>
                    <td className="py-3 pr-4 text-white/60">
                      {formatMoney(row.totalAmountMinor || 0)}
                    </td>
                    <td className="py-3 text-white/55">
                      {formatDate(row.latestTransactionDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PlatformSection>
      </div>

      <PlatformSection
        title="Recent Reconciliation Runs"
        description="Latest run outcomes across schools. Resolution still happens in school-level finance workflows."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/45">
                <th className="pb-3 font-medium">School</th>
                <th className="pb-3 font-medium">Mode</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Inspected</th>
                <th className="pb-3 font-medium">Matched</th>
                <th className="pb-3 font-medium">Escalations</th>
                <th className="pb-3 font-medium">Started</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr key={String(run._id)} className="border-b border-white/5 align-top">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/platform/schools/${String(run.schoolId)}`}
                      className="font-medium text-white transition-colors hover:text-cyan-200"
                    >
                      {schoolMap.get(String(run.schoolId)) || "Unknown school"}
                    </Link>
                    {run.errorMessage ? (
                      <p className="mt-1 text-xs text-rose-200/70">{run.errorMessage}</p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4 capitalize text-white/60">{run.mode}</td>
                  <td className="py-3 pr-4">
                    <PlatformPill tone={RUN_STATUS_TONE[run.status]}>{run.status}</PlatformPill>
                  </td>
                  <td className="py-3 pr-4 text-white">{run.summary.inspectedIngestion.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-white/60">{run.summary.matched.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-white/60">
                    {(run.summary.ambiguous + run.summary.staleEscalated + run.summary.errors).toLocaleString()}
                  </td>
                  <td className="py-3 text-white/55">{formatTimestamp(run.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PlatformSection>
    </div>
  );
}
