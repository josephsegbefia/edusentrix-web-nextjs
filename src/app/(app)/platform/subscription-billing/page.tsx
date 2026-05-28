import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  CheckCircle2,
  CreditCard,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { SubscriptionAddOn } from "@/models/SubscriptionAddOn";
import { School } from "@/models/School";
import {
  PlatformPageHeader,
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformSection,
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
  cancelled: "text-white/30",
  expired: "text-white/30",
  past_due: "text-amber-300",
};

const PLAN_TONE: Record<string, string> = {
  pilot: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  starter: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  growth: "border-teal-500/30 bg-teal-500/10 text-teal-200",
  enterprise: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

const ADDON_LABELS: Record<string, string> = {
  leo_credits: "Leo AI Credits",
  learn_seats: "Learn Seats",
  storage_gb: "Storage (GB)",
  meeting_minutes: "Meeting Minutes",
  sms_credits: "SMS Credits",
  whatsapp_credits: "WhatsApp Credits",
};

export default async function SubscriptionBillingPage() {
  const auth = await requirePlatformUser();
  if (!auth.ok) redirect("/dashboard");

  if (!hasPlatformPermission(auth.actor, "platform.billing.read")) {
    redirect("/platform");
  }

  await connectToDatabase();

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    statusDistribution,
    revenueByPlan,
    expiringSchools,
    gracePeriodSchools,
    pastDueSchools,
    totalActiveSchools,
    addonRevenue,
    addonsByType,
  ] = await Promise.all([
    SchoolSubscription.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    SchoolSubscription.aggregate([
      { $match: { status: "active", tierCode: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: { tierCode: "$tierCode", tierName: "$tierName" },
          totalRevenue: { $sum: "$effectivePriceMinor" },
          schoolCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]),

    SchoolSubscription.find({
      status: "active",
      endsAt: { $gte: now, $lte: in30Days },
    })
      .select("schoolId tierName tierCode endsAt effectivePriceMinor")
      .limit(20)
      .lean<Array<{ schoolId: unknown; tierName?: string | null; tierCode?: string | null; endsAt?: Date | null; effectivePriceMinor?: number }>>(),

    SchoolSubscription.find({ status: "grace" })
      .select("schoolId tierName tierCode gracePeriodEndsAt")
      .limit(20)
      .lean<Array<{ schoolId: unknown; tierName?: string | null; tierCode?: string | null; gracePeriodEndsAt?: Date | null }>>(),

    SchoolSubscription.find({ status: "past_due" })
      .select("schoolId tierName tierCode endsAt")
      .limit(20)
      .lean<Array<{ schoolId: unknown; tierName?: string | null; tierCode?: string | null; endsAt?: Date | null }>>(),

    School.countDocuments({ status: "active" }),

    SubscriptionAddOn.aggregate([
      { $match: { status: "credited" } },
      { $group: { _id: null, total: { $sum: "$priceMinor" } } },
    ]),

    SubscriptionAddOn.aggregate([
      { $match: { status: "credited" } },
      {
        $group: {
          _id: "$addonType",
          totalRevenue: { $sum: "$priceMinor" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]),
  ]);

  // Enrich expiring schools with names
  const schoolIds = [
    ...expiringSchools.map((s) => s.schoolId),
    ...gracePeriodSchools.map((s) => s.schoolId),
    ...pastDueSchools.map((s) => s.schoolId),
  ];
  const schoolNameMap: Record<string, string> = {};
  if (schoolIds.length > 0) {
    const schools = await School.find({ _id: { $in: schoolIds } })
      .select("name")
      .lean<Array<{ _id: unknown; name?: string }>>()
      .then((arr) => arr);
    for (const s of schools) {
      schoolNameMap[String(s._id)] = s.name ?? "Unknown";
    }
  }

  const statusMap: Record<string, number> = {};
  for (const s of statusDistribution) {
    statusMap[s._id ?? "unknown"] = s.count;
  }

  const totalSubscriptions = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const activeCount = statusMap["active"] ?? 0;
  const totalARRMinor = revenueByPlan.reduce((sum: number, r: any) => sum + (r.totalRevenue ?? 0), 0);

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Revenue & Billing"
        title="Subscription billing dashboard"
        description="Platform-wide subscription health, revenue by plan, add-on sales, and schools requiring attention."
        actions={
          <Link
            href="/platform/subscription-plans"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <Layers className="h-4 w-4" />
            Manage plans
          </Link>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={Building2}
          label="Active schools"
          value={String(totalActiveSchools)}
          note={`${totalSubscriptions} subscriptions`}
          tone="cyan"
        />
        <PlatformMetricCard
          icon={CheckCircle2}
          label="Active subscriptions"
          value={String(activeCount)}
          note={`${Math.round((activeCount / Math.max(1, totalSubscriptions)) * 100)}% of all`}
          tone="emerald"
        />
        <PlatformMetricCard
          icon={TrendingUp}
          label="Recurring revenue"
          value={formatGHS(totalARRMinor)}
          note="Sum of active plan prices"
          tone="violet"
        />
        <PlatformMetricCard
          icon={Sparkles}
          label="Add-on revenue"
          value={formatGHS(addonRevenue[0]?.total ?? 0)}
          note="Credited add-ons total"
          tone="amber"
        />
      </PlatformMetricGrid>

      {/* Attention required */}
      {(expiringSchools.length > 0 || gracePeriodSchools.length > 0 || pastDueSchools.length > 0) && (
        <PlatformSection
          title="Requires attention"
          description="Schools expiring soon, in grace period, or past due."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {/* Expiring soon */}
            <div className={cn(glassPanelClass, "px-0 py-0")}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
              <div className="border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                  <p className="text-xs font-semibold text-amber-200">Expiring ≤30 days</p>
                  <span className="ml-auto rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                    {expiringSchools.length}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-white/5 px-4">
                {expiringSchools.length === 0 ? (
                  <p className="py-4 text-xs text-white/30">None</p>
                ) : expiringSchools.map((s) => (
                  <div key={String(s.schoolId)} className="flex items-center justify-between py-2.5">
                    <div>
                      <Link
                        href={`/platform/schools/${s.schoolId}/subscription`}
                        className="text-xs text-white/70 transition hover:text-white"
                      >
                        {schoolNameMap[String(s.schoolId)] ?? "Unknown"}
                      </Link>
                      <p className="text-[10px] text-white/30">{s.tierName ?? "—"}</p>
                    </div>
                    <p className="text-[10px] text-amber-300/70">
                      {s.endsAt ? new Date(s.endsAt).toLocaleDateString("en-GH") : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Grace period */}
            <div className={cn(glassPanelClass, "px-0 py-0")}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
              <div className="border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-300" />
                  <p className="text-xs font-semibold text-orange-200">Grace period</p>
                  <span className="ml-auto rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-300">
                    {gracePeriodSchools.length}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-white/5 px-4">
                {gracePeriodSchools.length === 0 ? (
                  <p className="py-4 text-xs text-white/30">None</p>
                ) : gracePeriodSchools.map((s) => (
                  <div key={String(s.schoolId)} className="flex items-center justify-between py-2.5">
                    <div>
                      <Link
                        href={`/platform/schools/${s.schoolId}/subscription`}
                        className="text-xs text-white/70 transition hover:text-white"
                      >
                        {schoolNameMap[String(s.schoolId)] ?? "Unknown"}
                      </Link>
                      <p className="text-[10px] text-white/30">{s.tierName ?? "—"}</p>
                    </div>
                    <p className="text-[10px] text-orange-300/70">
                      {s.gracePeriodEndsAt ? new Date(s.gracePeriodEndsAt).toLocaleDateString("en-GH") : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Past due */}
            <div className={cn(glassPanelClass, "px-0 py-0")}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
              <div className="border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-rose-300" />
                  <p className="text-xs font-semibold text-rose-200">Past due</p>
                  <span className="ml-auto rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300">
                    {pastDueSchools.length}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-white/5 px-4">
                {pastDueSchools.length === 0 ? (
                  <p className="py-4 text-xs text-white/30">None</p>
                ) : pastDueSchools.map((s) => (
                  <div key={String(s.schoolId)} className="flex items-center justify-between py-2.5">
                    <Link
                      href={`/platform/schools/${s.schoolId}/subscription`}
                      className="text-xs text-white/70 transition hover:text-white"
                    >
                      {schoolNameMap[String(s.schoolId)] ?? "Unknown"}
                    </Link>
                    <p className="text-[10px] text-white/30">{s.tierName ?? "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PlatformSection>
      )}

      {/* Revenue by plan */}
      <PlatformSection
        title="Revenue by plan"
        description="Sum of effective subscription prices across active subscriptions."
      >
        <div className={cn(glassPanelClass, "px-0 py-0")}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
          {revenueByPlan.length === 0 ? (
            <div className="py-8 text-center text-xs text-white/30">
              No active subscriptions yet.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {revenueByPlan.map((r: any) => (
                <div
                  key={r._id.tierCode}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      PLAN_TONE[r._id.tierCode] ?? "border-white/10 bg-white/5 text-white/50"
                    )}>
                      {r._id.tierCode ?? "—"}
                    </span>
                    <span className="text-sm text-white/70">{r._id.tierName ?? "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-5 text-right">
                    <span className="text-xs text-white/40">{r.schoolCount} school{r.schoolCount !== 1 ? "s" : ""}</span>
                    <span className="font-mono text-sm font-semibold text-white/80">
                      {formatGHS(r.totalRevenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PlatformSection>

      {/* Status distribution + Add-ons */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Status distribution */}
        <PlatformSection title="Subscription status" description="Distribution across all subscription records.">
          <div className={cn(glassPanelClass, "px-0 py-0")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <div className="divide-y divide-white/5">
              {Object.entries(statusMap).sort(([, a], [, b]) => b - a).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between px-5 py-3">
                  <span className={cn("text-xs capitalize", STATUS_TONE[status] ?? "text-white/50")}>
                    {status.replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-sm text-white/70">{count}</span>
                </div>
              ))}
              {Object.keys(statusMap).length === 0 && (
                <p className="px-5 py-4 text-xs text-white/30">No subscriptions yet.</p>
              )}
            </div>
          </div>
        </PlatformSection>

        {/* Add-on sales */}
        <PlatformSection title="Add-on sales" description="Credited add-on purchases by type.">
          <div className={cn(glassPanelClass, "px-0 py-0")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            <div className="divide-y divide-white/5">
              {addonsByType.length === 0 ? (
                <p className="px-5 py-4 text-xs text-white/30">No add-ons credited yet.</p>
              ) : addonsByType.map((a: any) => (
                <div key={a._id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-xs text-white/70">{ADDON_LABELS[a._id] ?? a._id}</p>
                    <p className="text-[10px] text-white/30">{a.count} purchase{a.count !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="font-mono text-sm text-violet-300">{formatGHS(a.totalRevenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </PlatformSection>
      </div>
    </div>
  );
}
