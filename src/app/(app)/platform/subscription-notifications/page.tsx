import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Bell,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Info,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  PlatformPageHeader,
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformSection,
} from "@/components/platform/platform-page-primitives";
import { glassPanelClass, glassInsetClass } from "@/lib/ui/glass-surfaces";
import { runSubscriptionHealthScan, type SubscriptionHealthAlert } from "@/lib/subscriptions/health-scan";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ALERT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  suspended: Ban,
  past_due: XCircle,
  grace_period_ending_soon: ShieldAlert,
  grace_period_active: AlertTriangle,
  expiring_soon: Clock3,
  pilot_ending_soon: Sparkles,
  no_subscription: CircleDashed,
};

const ALERT_TONE: Record<string, string> = {
  critical: "border-rose-500/30 bg-rose-500/10",
  warning: "border-amber-500/30 bg-amber-500/10",
  info: "border-white/10 bg-white/5",
};

const ALERT_ICON_TONE: Record<string, string> = {
  critical: "text-rose-300",
  warning: "text-amber-300",
  info: "text-white/40",
};

const ALERT_TYPE_LABEL: Record<string, string> = {
  suspended: "Suspended",
  past_due: "Past due",
  grace_period_ending_soon: "Grace ending soon",
  grace_period_active: "Grace period",
  expiring_soon: "Expiring soon",
  pilot_ending_soon: "Pilot ending",
  no_subscription: "No subscription",
};

function AlertCard({ alert }: { alert: SubscriptionHealthAlert }) {
  const Icon = ALERT_ICON[alert.alertType] ?? AlertTriangle;
  const tone = ALERT_TONE[alert.severity] ?? ALERT_TONE.info;
  const iconTone = ALERT_ICON_TONE[alert.severity] ?? "text-white/40";

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", tone)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconTone)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-white/80">{alert.schoolName}</p>
          <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">
            {ALERT_TYPE_LABEL[alert.alertType] ?? alert.alertType}
          </span>
          {alert.planName ? (
            <span className="text-[10px] text-white/30">{alert.planName}</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-white/55">{alert.message}</p>
      </div>
      <Link
        href={alert.actionUrl}
        className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/50 transition hover:text-white"
      >
        Manage
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

export default async function SubscriptionNotificationsPage() {
  const auth = await requirePlatformUser();
  if (!auth.ok) redirect("/dashboard");

  if (!hasPlatformPermission(auth.actor, "platform.billing.read")) {
    redirect("/platform");
  }

  await connectToDatabase();

  const scan = await runSubscriptionHealthScan({
    expiringSoonDays: 30,
    pilotEndingSoonDays: 14,
    graceEndingSoonDays: 7,
  });

  const critical = scan.alerts.filter((a) => a.severity === "critical");
  const warnings = scan.alerts.filter((a) => a.severity === "warning");
  const info = scan.alerts.filter((a) => a.severity === "info");

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Subscription Operations"
        title="Subscription notifications"
        description="Schools requiring immediate or near-term attention. Scan runs live on each page load."
        actions={
          <Link
            href="/platform/subscription-billing"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Billing dashboard
          </Link>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={XCircle}
          label="Critical"
          value={String(scan.summary.critical)}
          note="Suspended + past due + grace ending"
          tone={scan.summary.critical > 0 ? "rose" : "emerald"}
        />
        <PlatformMetricCard
          icon={AlertTriangle}
          label="Warnings"
          value={String(scan.summary.warning)}
          note="Expiring soon + grace active + pilot"
          tone={scan.summary.warning > 0 ? "amber" : "emerald"}
        />
        <PlatformMetricCard
          icon={Info}
          label="Informational"
          value={String(scan.summary.info)}
          note="No subscription + pilot far out"
          tone="cyan"
        />
        <PlatformMetricCard
          icon={Bell}
          label="Total alerts"
          value={String(scan.summary.total)}
          note={`Scanned at ${new Date(scan.scannedAt).toLocaleTimeString("en-GH")}`}
          tone={scan.summary.total === 0 ? "emerald" : "violet"}
        />
      </PlatformMetricGrid>

      {scan.summary.total === 0 ? (
        <div className={cn(glassInsetClass, "flex items-center gap-4 px-5 py-6")}>
          <CheckCircle2 className="h-6 w-6 text-emerald-300" />
          <div>
            <p className="text-sm font-semibold text-emerald-200">All clear</p>
            <p className="text-xs text-white/40">No subscription alerts at this time.</p>
          </div>
        </div>
      ) : null}

      {critical.length > 0 && (
        <PlatformSection title="Critical" description="These require immediate action.">
          <div className="space-y-2">
            {critical.map((a) => <AlertCard key={`${a.schoolId}-${a.alertType}`} alert={a} />)}
          </div>
        </PlatformSection>
      )}

      {warnings.length > 0 && (
        <PlatformSection title="Warnings" description="Upcoming expiries and active grace periods.">
          <div className="space-y-2">
            {warnings.map((a) => <AlertCard key={`${a.schoolId}-${a.alertType}`} alert={a} />)}
          </div>
        </PlatformSection>
      )}

      {info.length > 0 && (
        <PlatformSection title="Informational" description="Schools without subscriptions and near-term pilot endings.">
          <div className="space-y-2">
            {info.map((a) => <AlertCard key={`${a.schoolId}-${a.alertType}`} alert={a} />)}
          </div>
        </PlatformSection>
      )}
    </div>
  );
}
