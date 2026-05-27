/**
 * /platform/subscriptions
 * Central hub — Subscriptions & Revenue.
 * Spec §14.2
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  Layers,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
  Zap,
} from "lucide-react";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { School } from "@/models/School";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";
import {
  PlatformPageHeader,
  PlatformMetricCard,
  PlatformMetricGrid,
} from "@/components/platform/platform-page-primitives";
import { glassPanelClass, glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatGHS(minor: number) {
  return `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}

const STATUS_TONE: Record<string, string> = {
  active: "text-emerald-300",
  pilot: "text-violet-300",
  grace: "text-amber-300",
  restricted_read_only: "text-orange-300",
  suspended: "text-rose-300",
  draft: "text-white/30",
  past_due: "text-amber-300",
};

type SubNavItem = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
};

const SUB_NAV: SubNavItem[] = [
  {
    href: "/platform/subscription-plans",
    label: "Plans",
    description: "Define plan features, pricing, and limits",
    icon: Layers,
    tone: "text-cyan-300",
  },
  {
    href: "/platform/subscriptions/schools",
    label: "School subscriptions",
    description: "Assign and manage subscriptions for each school",
    icon: Building2,
    tone: "text-teal-300",
  },
  {
    href: "/platform/subscriptions/payment-charges",
    label: "Payment charges",
    description: "Configure transaction fee policies",
    icon: CreditCard,
    tone: "text-violet-300",
  },
  {
    href: "/platform/subscriptions/add-ons",
    label: "Add-ons & Credits",
    description: "Manage purchasable credit packages",
    icon: ShoppingCart,
    tone: "text-amber-300",
  },
  {
    href: "/platform/subscriptions/usage",
    label: "Usage",
    description: "AI credits, meetings, storage consumption",
    icon: Zap,
    tone: "text-emerald-300",
  },
  {
    href: "/platform/subscription-billing",
    label: "Billing dashboard",
    description: "Revenue by plan and status distribution",
    icon: BarChart3,
    tone: "text-cyan-300",
  },
  {
    href: "/platform/subscription-notifications",
    label: "Alerts",
    description: "Schools needing attention",
    icon: Bell,
    tone: "text-rose-300",
  },
  {
    href: "/platform/subscriptions/leakage",
    label: "Leakage scanner",
    description: "Detect entitlement inconsistencies",
    icon: ShieldAlert,
    tone: "text-rose-300",
  },
  {
    href: "/platform/subscriptions/settings",
    label: "Settings",
    description: "Global subscription defaults",
    icon: Settings,
    tone: "text-white/50",
  },
];

export default async function SubscriptionsHubPage() {
  const auth = await requirePlatformUser();
  if (!auth.ok) redirect("/dashboard");

  if (!hasPlatformPermission(auth.actor, "platform.billing.read")) {
    redirect("/platform");
  }

  await connectToDatabase();

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    totalSchools,
    statusDistribution,
    revenueByPlan,
    attentionCount,
    recentEvents,
    pilotSchools,
    upcomingRenewals,
  ] = await Promise.all([
    School.countDocuments({ status: "active" }),

    SchoolSubscription.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    SchoolSubscription.aggregate([
      { $match: { status: "active" } },
      {
        $group: {
          _id: "$tierCode",
          total: { $sum: "$effectivePriceMinor" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),

    SchoolSubscription.countDocuments({
      $or: [
        { status: "past_due" },
        { status: "grace" },
        { status: "suspended" },
        { status: "active", endsAt: { $gte: now, $lte: in30Days } },
      ],
    }),

    SubscriptionEvent.find({
      eventType: { $nin: ["usage_event", "entitlement_audit"] },
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean<Array<{
        _id: unknown;
        eventType: string;
        summary: string;
        actorEmail?: string | null;
        createdAt: Date;
        schoolId: unknown;
      }>>(),

    SchoolSubscription.find({ status: "pilot" })
      .select("schoolId tierName pilotEndsAt")
      .limit(10)
      .lean<Array<{
        schoolId: unknown;
        tierName?: string | null;
        pilotEndsAt?: Date | null;
        _id: unknown;
      }>>(),

    SchoolSubscription.find({
      status: "active",
      endsAt: { $gte: now, $lte: in30Days },
    })
      .select("schoolId tierName endsAt effectivePriceMinor")
      .limit(10)
      .lean<Array<{
        schoolId: unknown;
        tierName?: string | null;
        endsAt?: Date | null;
        effectivePriceMinor?: number;
        _id: unknown;
      }>>(),
  ]);

  // Fetch school names
  const needNameIds = [
    ...pilotSchools.map((s) => s.schoolId),
    ...upcomingRenewals.map((s) => s.schoolId),
  ];
  const nameMap: Record<string, string> = {};
  if (needNameIds.length) {
    const schools = await School.find({ _id: { $in: needNameIds } })
      .select("name")
      .lean<Array<{ _id: unknown; name?: string }>>()
      .then((a) => a);
    for (const s of schools) nameMap[String(s._id)] = s.name ?? "Unknown";
  }

  const statusMap: Record<string, number> = {};
  for (const s of statusDistribution) statusMap[s._id ?? "unknown"] = s.count;

  const totalSubs = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const activeCount = statusMap["active"] ?? 0;
  const totalRevMinor = revenueByPlan.reduce((a: number, r: any) => a + r.total, 0);

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Platform Operations"
        title="Subscriptions & Revenue"
        description="Manage plans, school subscriptions, transaction charges, add-ons, and usage."
      />

      {/* KPI metrics */}
      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={Building2}
          label="Active schools"
          value={String(totalSchools)}
          note={`${totalSubs} subscriptions`}
          tone="cyan"
        />
        <PlatformMetricCard
          icon={CheckCircle2}
          label="Active subscriptions"
          value={String(activeCount)}
          note={`${totalSubs > 0 ? Math.round((activeCount / totalSubs) * 100) : 0}% of all`}
          tone="emerald"
        />
        <PlatformMetricCard
          icon={TrendingUp}
          label="Recurring revenue"
          value={formatGHS(totalRevMinor)}
          note="Sum of active plan prices"
          tone="violet"
        />
        <PlatformMetricCard
          icon={AlertTriangle}
          label="Need attention"
          value={String(attentionCount)}
          note="Expiring, past-due, grace, suspended"
          tone={attentionCount > 0 ? "rose" : "emerald"}
        />
      </PlatformMetricGrid>

      {/* Sub-navigation cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUB_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                glassPanelClass,
                "group flex items-start gap-3 px-4 py-4 transition hover:border-white/20"
              )}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
              <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2">
                <Icon className={cn("h-4 w-4", item.tone)} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/80 group-hover:text-white">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-white/40 leading-snug">{item.description}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Status distribution */}
        <div className={cn(glassPanelClass, "px-0 py-0")}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-xs font-semibold text-white/60">Subscription status</p>
          </div>
          <div className="divide-y divide-white/5">
            {Object.entries(statusMap).sort(([, a], [, b]) => b - a).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between px-4 py-2.5">
                <span className={cn("text-xs capitalize", STATUS_TONE[status] ?? "text-white/50")}>
                  {status.replace(/_/g, " ")}
                </span>
                <span className="font-mono text-sm text-white/60">{count}</span>
              </div>
            ))}
            {Object.keys(statusMap).length === 0 && (
              <p className="px-4 py-4 text-xs text-white/30">No subscriptions yet.</p>
            )}
          </div>
        </div>

        {/* Upcoming renewals */}
        <div className={cn(glassPanelClass, "px-0 py-0")}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-xs font-semibold text-white/60">Upcoming renewals</p>
            <Link href="/platform/subscription-notifications" className="text-[10px] text-teal-400/60 hover:text-teal-300">
              View all
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {upcomingRenewals.length === 0 && (
              <p className="px-4 py-4 text-xs text-white/30">None in the next 30 days.</p>
            )}
            {upcomingRenewals.map((r) => (
              <div key={String(r._id)} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <Link
                    href={`/platform/schools/${r.schoolId}/subscription`}
                    className="text-xs text-white/70 hover:text-white"
                  >
                    {nameMap[String(r.schoolId)] ?? "Unknown"}
                  </Link>
                  <p className="text-[10px] text-white/30">{r.tierName ?? "—"}</p>
                </div>
                <p className="text-[10px] text-amber-300/70">
                  {r.endsAt ? new Date(r.endsAt).toLocaleDateString("en-GH", { day: "2-digit", month: "short" }) : "—"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Pilot schools */}
        <div className={cn(glassPanelClass, "px-0 py-0")}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-xs font-semibold text-white/60">Pilot schools</p>
            <Link href="/platform/subscriptions/schools?status=pilot" className="text-[10px] text-teal-400/60 hover:text-teal-300">
              View all
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {pilotSchools.length === 0 && (
              <p className="px-4 py-4 text-xs text-white/30">No pilot schools.</p>
            )}
            {pilotSchools.map((s) => (
              <div key={String(s._id)} className="flex items-center justify-between px-4 py-2.5">
                <Link
                  href={`/platform/schools/${s.schoolId}/subscription`}
                  className="text-xs text-white/70 hover:text-white"
                >
                  {nameMap[String(s.schoolId)] ?? "Unknown"}
                </Link>
                <p className="text-[10px] text-violet-300/70">
                  {s.pilotEndsAt
                    ? `ends ${new Date(s.pilotEndsAt).toLocaleDateString("en-GH", { day: "2-digit", month: "short" })}`
                    : "no expiry"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div className={cn(glassPanelClass, "px-0 py-0")}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <p className="text-xs font-semibold text-white/60">Recent subscription events</p>
        </div>
        {recentEvents.length === 0 ? (
          <p className="px-5 py-4 text-xs text-white/30">No events yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {recentEvents.map((ev) => (
              <div key={String(ev._id)} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-xs text-white/70">{ev.summary}</p>
                  <p className="mt-0.5 text-[10px] text-white/30">
                    {ev.actorEmail ? `${ev.actorEmail} · ` : ""}
                    {new Date(ev.createdAt).toLocaleDateString("en-GH", { dateStyle: "medium" })}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-white/25">
                  {ev.eventType.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
