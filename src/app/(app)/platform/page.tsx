import Link from "next/link";
import { ArrowRight, BarChart3, Clock3, DatabaseZap, School2 } from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { formatMoney } from "@/lib/fees/money";
import { getPlatformRevenueSummary } from "@/lib/platform-billing/revenue-summary";
import { PilotCloseoutRun } from "@/models/PilotCloseoutRun";
import { ProviderSyncRun } from "@/models/ProviderSyncRun";
import { School } from "@/models/School";

export default async function PlatformOverviewPage() {
  await connectToDatabase();

  const [revenue, totalSchools, pendingPilotApprovals, recentSyncRuns] =
    await Promise.all([
      getPlatformRevenueSummary(),
      School.countDocuments({}),
      PilotCloseoutRun.countDocuments({ approvalStatus: "pending_approval" }),
      ProviderSyncRun.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select("provider status summary createdAt")
        .lean<Array<{
          provider: string;
          status: string;
          summary?: string | null;
          createdAt: Date;
        }>>(),
    ]);

  const quickLinks = [
    { href: "/platform/billing/revenue", label: "Revenue Analytics" },
    { href: "/platform/billing/sync", label: "Provider Sync" },
    { href: "/platform/schools", label: "School Portfolio" },
    { href: "/platform/pilot", label: "Pilot Closeout" },
  ];

  return (
    <div className="space-y-6 p-2 md:p-4">
      <section className="rounded-3xl border border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-black p-6 text-white shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
              Platform Command Center
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Subscription, revenue, and operating margin at a glance
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/65">
              This view consolidates live billing health across schools so platform
              decisions are anchored to current revenue, cost, and pending review work.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <span>{link.label}</span>
                <ArrowRight className="ml-3 h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={School2}
          label="Schools"
          value={String(totalSchools)}
          note={`${revenue.summary.activeSchools} active schools`}
        />
        <MetricCard
          icon={BarChart3}
          label="Realized MRR"
          value={formatMoney(revenue.summary.realizedMrrMinor)}
          note={`${revenue.summary.activeSubscriptions} live subscriptions`}
        />
        <MetricCard
          icon={DatabaseZap}
          label="Gross Margin"
          value={formatMoney(revenue.summary.grossMarginMinor)}
          note={`Usage cost ${formatMoney(revenue.summary.usageAttributedCostMinor)}`}
        />
        <MetricCard
          icon={Clock3}
          label="Pending Pilot Reviews"
          value={String(pendingPilotApprovals)}
          note={`Period ${revenue.periodStart} to ${revenue.periodEnd}`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Revenue Mix</h2>
              <p className="text-sm text-white/55">
                Current period revenue and cost structure.
              </p>
            </div>
            <Link
              href="/platform/billing/revenue"
              className="text-sm font-medium text-cyan-200 hover:text-cyan-100"
            >
              Open detailed analytics
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <MiniStat
              label="ARR Run-Rate"
              value={formatMoney(revenue.summary.arrRunRateMinor)}
            />
            <MiniStat
              label="Transaction Fee Revenue"
              value={formatMoney(revenue.summary.transactionFeeRevenueMinor)}
            />
            <MiniStat
              label="Processor Fee Cost"
              value={formatMoney(revenue.summary.processorFeeCostMinor)}
            />
            <MiniStat
              label="Service Cost Ledger"
              value={formatMoney(revenue.summary.serviceCostLedgerMinor)}
            />
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold text-white/80">Top Tier Mix</h3>
            {revenue.tierMix.slice(0, 4).map((tier) => (
              <div
                key={tier.tierCode}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{tier.tierName}</p>
                  <p className="text-xs text-white/45">{tier.tierCode}</p>
                </div>
                <p className="text-sm text-white/70">{tier.schools} schools</p>
              </div>
            ))}
            {revenue.tierMix.length === 0 ? (
              <p className="text-sm text-white/50">No active tier assignments yet.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Recent Sync Runs</h2>
              <p className="text-sm text-white/55">
                Latest provider sync activity and failure signals.
              </p>
            </div>
            <Link
              href="/platform/billing/sync"
              className="text-sm font-medium text-cyan-200 hover:text-cyan-100"
            >
              Manage sync
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentSyncRuns.map((run) => (
              <div
                key={`${run.provider}-${run.createdAt.toISOString()}`}
                className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium capitalize text-white">
                      {run.provider}
                    </p>
                    <p className="text-xs text-white/45">
                      {run.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      run.status === "completed"
                        ? "bg-emerald-400/10 text-emerald-100"
                        : run.status === "failed"
                          ? "bg-red-400/10 text-red-100"
                          : "bg-amber-400/10 text-amber-100"
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
                {run.summary ? (
                  <p className="mt-2 text-xs text-white/55">{run.summary}</p>
                ) : null}
              </div>
            ))}
            {recentSyncRuns.length === 0 ? (
              <p className="text-sm text-white/50">No provider sync runs recorded yet.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
      <div className="flex items-center justify-between">
        <span className="rounded-2xl bg-white/8 p-3">
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-xs uppercase tracking-[0.16em] text-white/45">{label}</p>
      </div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-white/50">{note}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
