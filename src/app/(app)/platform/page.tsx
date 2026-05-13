import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  CheckSquare,
  Clock3,
  ClipboardList,
  ListTodo,
  DatabaseZap,
  FileWarning,
  Flag,
  FlaskConical,
  Inbox,
  Landmark,
  Mail,
  Presentation,
  RefreshCw,
  School2,
  Settings,
  Sparkles,
  Users,
  Webhook,
} from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { formatMoney } from "@/lib/fees/money";
import { getPlatformRevenueSummary } from "@/lib/platform-billing/revenue-summary";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformPill,
  PlatformSection,
  formatDate,
  formatTimestamp,
} from "@/components/platform/platform-page-primitives";
import { PilotCloseoutRun } from "@/models/PilotCloseoutRun";
import { ProviderSyncRun } from "@/models/ProviderSyncRun";
import { School } from "@/models/School";

export const dynamic = "force-dynamic";

type Destination = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type DestinationGroup = {
  title: string;
  blurb: string;
  items: Destination[];
};

const DESTINATION_GROUPS: DestinationGroup[] = [
  {
    title: "Growth & schools",
    blurb: "New demand, demos, and onboarded institutions.",
    items: [
      {
        href: "/platform/applications",
        label: "Applications",
        description: "Review and approve school signup requests.",
        icon: CheckSquare,
      },
      {
        href: "/platform/demo-leads",
        label: "Demo leads",
        description: "Prospects who tried the demo sandbox.",
        icon: Presentation,
      },
      {
        href: "/platform/schools",
        label: "Schools",
        description: "Portfolio, subscriptions, and per-school tools.",
        icon: Building2,
      },
      {
        href: "/platform/staff",
        label: "Staff",
        description: "Internal EduSentrix operators, roles, and permissions.",
        icon: Users,
      },
      {
        href: "/platform/pilot",
        label: "Pilot closeout",
        description: "Period-end reviews that need approval.",
        icon: FlaskConical,
      },
      {
        href: "/platform/delegations",
        label: "Delegations",
        description: "Scoped platform staff assignments by school and task area.",
        icon: ClipboardList,
      },
      {
        href: "/platform/tasks",
        label: "Tasks",
        description: "Implementation, training, support, and follow-up work queue.",
        icon: ListTodo,
      },
    ],
  },
  {
    title: "Revenue & billing",
    blurb: "Money in, costs out, and provider reconciliation.",
    items: [
      {
        href: "/platform/billing",
        label: "Billing overview",
        description: "Summary of subscriptions and payouts.",
        icon: Banknote,
      },
      {
        href: "/platform/billing/revenue",
        label: "Revenue analytics",
        description: "MRR, fees, and margin trends.",
        icon: BarChart3,
      },
      {
        href: "/platform/billing/usage",
        label: "Usage ledger",
        description: "Metered usage by school.",
        icon: DatabaseZap,
      },
      {
        href: "/platform/billing/costs",
        label: "Cost ledger",
        description: "Internal and pass-through costs.",
        icon: DatabaseZap,
      },
      {
        href: "/platform/billing/sync",
        label: "Provider sync",
        description: "Stripe and other provider sync jobs.",
        icon: RefreshCw,
      },
      {
        href: "/platform/billing/events",
        label: "Billing events",
        description: "Timeline of billing-related activity.",
        icon: Clock3,
      },
      {
        href: "/platform/billing/tiers",
        label: "Subscription tiers",
        description: "Plans and pricing catalog.",
        icon: Flag,
      },
      {
        href: "/platform/reconciliation",
        label: "Reconciliation",
        description: "Fees reconciliation sessions.",
        icon: Landmark,
      },
    ],
  },
  {
    title: "Operations",
    blurb: "Comms, integrations, and forensic review.",
    items: [
      {
        href: "/platform/email",
        label: "Email inbox",
        description: "Operational mail threads.",
        icon: Inbox,
      },
      {
        href: "/platform/emails",
        label: "Email templates",
        description: "Transactional template registry.",
        icon: Mail,
      },
      {
        href: "/platform/webhooks",
        label: "Webhooks",
        description: "Inbound webhook endpoints and logs.",
        icon: Webhook,
      },
      {
        href: "/platform/audit",
        label: "Audit logs",
        description: "Who changed what, across the platform.",
        icon: FileWarning,
      },
    ],
  },
  {
    title: "System",
    blurb: "Feature rollout and global configuration.",
    items: [
      {
        href: "/platform/flags",
        label: "Feature flags",
        description: "Toggle product behavior by school or cohort.",
        icon: Sparkles,
      },
      {
        href: "/platform/settings",
        label: "Settings",
        description: "Platform-wide preferences and secrets UI.",
        icon: Settings,
      },
    ],
  },
];

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
        .lean<
          Array<{
            provider: string;
            status: string;
            summary?: string | null;
            createdAt: Date;
          }>
        >(),
    ]);

  const periodLabel = `${formatDate(revenue.periodStart)} – ${formatDate(revenue.periodEnd)}`;

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Platform admin"
        title="Overview"
        description={`This is the home screen for platform operators. Scan the pulse metrics for a quick health check, then open a workspace below—the sections match the sidebar. Revenue and margin figures use the current calendar month (${periodLabel}) until you change the range inside analytics.`}
      />

      {pendingPilotApprovals > 0 ? (
        <div className="rounded-3xl border border-amber-400/25 bg-amber-500/10 px-5 py-4 text-amber-50">
          <p className="text-sm font-medium text-amber-100">
            {pendingPilotApprovals} pilot closeout
            {pendingPilotApprovals === 1 ? "" : "s"} awaiting approval
          </p>
          <p className="mt-1 text-sm text-amber-100/80">
            Review periods and sign-offs in Pilot before schools are finalized for the
            period.
          </p>
          <Link
            href="/platform/pilot"
            className="mt-3 inline-flex items-center text-sm font-medium text-amber-200 underline-offset-4 hover:text-white hover:underline"
          >
            Open pilot closeout
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      ) : null}

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={School2}
          label="Schools"
          value={totalSchools.toLocaleString()}
          note={`${revenue.summary.activeSchools.toLocaleString()} marked active in billing`}
          tone="cyan"
        />
        <PlatformMetricCard
          icon={BarChart3}
          label="Realized MRR"
          value={formatMoney(revenue.summary.realizedMrrMinor)}
          note="Monthly recurring revenue from live subscriptions (this month)."
          tone="emerald"
        />
        <PlatformMetricCard
          icon={DatabaseZap}
          label="Gross margin"
          value={formatMoney(revenue.summary.grossMarginMinor)}
          note={`After usage & fees; usage cost ${formatMoney(revenue.summary.usageAttributedCostMinor)}`}
          tone="amber"
        />
        <PlatformMetricCard
          icon={FlaskConical}
          label="Pilot queue"
          value={pendingPilotApprovals.toLocaleString()}
          note={
            pendingPilotApprovals === 0
              ? "No closeouts waiting on you."
              : "Closeouts pending platform approval."
          }
          tone={pendingPilotApprovals > 0 ? "rose" : "violet"}
        />
      </PlatformMetricGrid>

      <PlatformSection
        title="Find the right workspace"
        description="Each card goes to a live tool. Descriptions explain what you do there, in plain language."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {DESTINATION_GROUPS.map((group) => (
            <div
              key={group.title}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5"
            >
              <h3 className="text-base font-semibold text-white">{group.title}</h3>
              <p className="mt-1 text-sm text-white/50">{group.blurb}</p>
              <ul className="mt-4 space-y-2">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group flex gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-white/10 hover:bg-white/5"
                    >
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 group-hover:text-white">
                        <item.icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium text-white group-hover:text-cyan-100">
                          {item.label}
                          <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                        <span className="mt-0.5 block text-sm text-white/45">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PlatformSection>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <PlatformSection
          title="Billing snapshot"
          description={`High-level numbers for ${periodLabel}. ARR is annualized run-rate from current MRR; transaction fees are net school payment fees; processor cost is what you pay card networks.`}
          action={
            <Link
              href="/platform/billing/revenue"
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Full revenue analytics
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SnapshotStat
              label="ARR run-rate"
              hint="MRR × 12, indicative."
              value={formatMoney(revenue.summary.arrRunRateMinor)}
            />
            <SnapshotStat
              label="Transaction fee revenue"
              hint="Fees retained on school payments."
              value={formatMoney(revenue.summary.transactionFeeRevenueMinor)}
            />
            <SnapshotStat
              label="Processor fee cost"
              hint="Paid to payment processors."
              value={formatMoney(revenue.summary.processorFeeCostMinor)}
            />
            <SnapshotStat
              label="Service cost ledger"
              hint="Recorded internal / vendor costs."
              value={formatMoney(revenue.summary.serviceCostLedgerMinor)}
            />
          </div>

          <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-sm font-semibold text-white/85">Subscription tier mix</h3>
              <p className="text-xs text-white/45">Active assignments by tier</p>
            </div>
            {revenue.tierMix.length === 0 ? (
              <p className="text-sm text-white/50">No active tier assignments yet.</p>
            ) : (
              <ul className="space-y-2">
                {revenue.tierMix.slice(0, 5).map((tier) => (
                  <li
                    key={tier.tierCode}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/25 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {tier.tierName}
                      </p>
                      <p className="text-xs text-white/40">{tier.tierCode}</p>
                    </div>
                    <PlatformPill tone="slate">
                      {tier.schools} school{tier.schools === 1 ? "" : "s"}
                    </PlatformPill>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PlatformSection>

        <PlatformSection
          title="Recent provider syncs"
          description="Latest jobs that pull or push billing data with external providers. Failures usually need a retry or credential check."
          action={
            <Link
              href="/platform/billing/sync"
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Sync console
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          }
        >
          {recentSyncRuns.length === 0 ? (
            <p className="text-sm text-white/50">No provider sync runs recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentSyncRuns.map((run) => (
                <li
                  key={`${run.provider}-${run.createdAt.toISOString()}`}
                  className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium capitalize text-white">
                      {run.provider}
                    </p>
                    <PlatformPill
                      tone={
                        run.status === "completed"
                          ? "emerald"
                          : run.status === "failed"
                            ? "rose"
                            : "amber"
                      }
                    >
                      {run.status}
                    </PlatformPill>
                  </div>
                  <p className="mt-1 text-xs text-white/45">
                    {formatTimestamp(run.createdAt)}
                  </p>
                  {run.summary ? (
                    <p className="mt-2 text-xs text-white/55">{run.summary}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </PlatformSection>
      </div>
    </div>
  );
}

function SnapshotStat({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/45">{hint}</p>
    </div>
  );
}
