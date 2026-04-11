"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  usePeriodStatus,
  type WarningLevel,
  type PeriodStatus,
} from "@/hooks/admin/usePeriodStatus";
import {
  AlertTriangle,
  Calendar,
  Clock,
  X,
  ChevronRight,
  Bell,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PeriodWarningBannerProps = {
  onCreatePeriod: () => void;
  className?: string;
  /** When SHS, copy references term alignment for Senior High. */
  schoolLevel?: "Basic" | "SHS" | null;
};

const warningConfig: Record<
  WarningLevel,
  {
    bgGradient: string;
    borderColor: string;
    iconBg: string;
    iconColor: string;
    textColor: string;
    accentColor: string;
    Icon: React.ElementType;
    dismissable: boolean;
  }
> = {
  none: {
    bgGradient: "from-transparent to-transparent",
    borderColor: "border-transparent",
    iconBg: "bg-transparent",
    iconColor: "text-transparent",
    textColor: "text-transparent",
    accentColor: "bg-transparent",
    Icon: Calendar,
    dismissable: true,
  },
  info: {
    bgGradient: "from-blue-500/15 via-blue-500/5 to-transparent",
    borderColor: "border-blue-400/40",
    iconBg: "bg-blue-500/20 border border-blue-400/30",
    iconColor: "text-blue-300",
    textColor: "text-blue-100",
    accentColor: "bg-blue-400/80",
    Icon: Calendar,
    dismissable: true,
  },
  warning: {
    bgGradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    borderColor: "border-amber-400/40",
    iconBg: "bg-amber-500/20 border border-amber-400/30",
    iconColor: "text-amber-300",
    textColor: "text-amber-100",
    accentColor: "bg-amber-400/80",
    Icon: Clock,
    dismissable: true,
  },
  urgent: {
    bgGradient: "from-orange-500/15 via-orange-500/5 to-transparent",
    borderColor: "border-orange-400/40",
    iconBg: "bg-orange-500/20 border border-orange-400/30",
    iconColor: "text-orange-300",
    textColor: "text-orange-100",
    accentColor: "bg-orange-400/80",
    Icon: AlertTriangle,
    dismissable: false,
  },
  critical: {
    bgGradient: "from-red-500/15 via-red-500/5 to-transparent",
    borderColor: "border-red-400/40",
    iconBg: "bg-red-500/20 border border-red-400/30",
    iconColor: "text-red-300",
    textColor: "text-red-100",
    accentColor: "bg-red-400/80",
    Icon: AlertCircle,
    dismissable: false,
  },
};

function getActionLabel(status: PeriodStatus): string {
  switch (status) {
    case "no_period":
      return "Create First Period";
    case "expired":
    case "grace_period":
      return "Create New Period";
    case "expiring_critical":
      return "Create New Period Now";
    case "expiring_very_soon":
    case "expiring_soon":
      return "Prepare Next Period";
    default:
      return "View Periods";
  }
}

function getSubtitle(
  status: PeriodStatus,
  schoolLevel?: "Basic" | "SHS" | null
): string | null {
  switch (status) {
    case "no_period":
      if (schoolLevel === "SHS") {
        return "Set up your school's academic calendar to start managing students, fees, and more. For Senior High, clear terms keep published results and reports aligned for families.";
      }
      return "Set up your school's academic calendar to start managing students, fees, and more.";
    case "expired":
      return "Some operations are blocked. Create a new period to restore full functionality.";
    case "grace_period":
      return "You're in a 7-day grace period. Most operations still work, but create a new period soon.";
    case "expiring_critical":
      return "Urgent action required to avoid service interruption.";
    default:
      return null;
  }
}

export function PeriodWarningBanner({
  onCreatePeriod,
  className,
  schoolLevel,
}: PeriodWarningBannerProps) {
  const { data: periodStatus, isLoading } = usePeriodStatus();
  const [dismissed, setDismissed] = React.useState(false);
  const dismissedKeyRef = React.useRef<string | null>(null);

  // Reset dismissed state when warning level changes
  React.useEffect(() => {
    if (periodStatus) {
      const key = `${periodStatus.status}-${periodStatus.daysUntilExpiry}-${periodStatus.daysSinceExpiry}`;
      if (dismissedKeyRef.current !== key) {
        dismissedKeyRef.current = key;
        setDismissed(false);
      }
    }
  }, [periodStatus]);

  if (isLoading || !periodStatus) return null;

  const { warningLevel, status, message, daysUntilExpiry, daysSinceExpiry } =
    periodStatus;

  // Don't show banner if no warning
  if (warningLevel === "none") return null;

  // Don't show if dismissed (only for dismissable warnings)
  const config = warningConfig[warningLevel];
  if (dismissed && config.dismissable) return null;

  const { Icon } = config;
  const actionLabel = getActionLabel(status);
  const subtitle = getSubtitle(status, schoolLevel);

  // Determine urgency indicator
  const showPulse =
    warningLevel === "critical" || warningLevel === "urgent";
  const showCountdown =
    daysUntilExpiry !== null &&
    daysUntilExpiry <= 7 &&
    (status === "expiring_critical" || status === "expiring_very_soon");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "relative overflow-hidden rounded-xl border shadow-lg shadow-black/20 backdrop-blur",
          `bg-linear-to-br ${config.bgGradient}`,
          config.borderColor,
          className
        )}
      >
        {/* Accent bar on top */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1",
            config.accentColor,
            showPulse && "animate-pulse"
          )}
        />

        {/* Subtle top glow */}
        <div
          className="pointer-events-none absolute inset-x-8 top-1 h-px bg-linear-to-r from-transparent via-white/30 to-transparent opacity-60"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-start gap-4 p-4">
          {/* Icon */}
          <div className={cn("p-2.5 rounded-lg shrink-0", config.iconBg)}>
            <Icon className={cn("h-5 w-5", config.iconColor)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className={cn("font-semibold text-sm", config.textColor)}>
                {status === "no_period"
                  ? "No Academic Period"
                  : status === "expired" || status === "grace_period"
                  ? "Period Ended"
                  : "Period Expiring Soon"}
              </h3>
              {showCountdown && daysUntilExpiry !== null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    config.iconBg,
                    config.textColor
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {daysUntilExpiry} day{daysUntilExpiry === 1 ? "" : "s"} left
                </span>
              )}
              {daysSinceExpiry !== null && daysSinceExpiry > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    config.iconBg,
                    config.textColor
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {daysSinceExpiry} day{daysSinceExpiry === 1 ? "" : "s"} ago
                </span>
              )}
            </div>
            <p className="text-sm text-white/80">{message}</p>
            {subtitle && (
              <p className="text-xs text-white/60 mt-1">{subtitle}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={onCreatePeriod}
              className={cn(
                "gap-1.5 text-xs font-medium",
                warningLevel === "critical"
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : warningLevel === "urgent"
                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                  : "bg-brand hover:bg-brand/90 text-black"
              )}
              size="sm"
            >
              {actionLabel}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            {config.dismissable && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDismissed(true)}
                className="h-8 w-8 text-white/50 hover:text-white/80 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Blocked operations indicator */}
        {(status === "expired" || status === "no_period") && (
          <div className="border-t border-white/10 px-4 py-2 bg-black/20">
            <div className="flex items-center gap-4 text-xs text-white/60">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Invoices blocked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Assessments blocked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Assignments blocked
              </span>
            </div>
          </div>
        )}

        {/* Grace period indicator */}
        {status === "grace_period" && (
          <div className="border-t border-white/10 px-4 py-2 bg-black/20">
            <div className="flex items-center gap-4 text-xs text-white/60">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Grace period: {7 - (daysSinceExpiry || 0)} days remaining
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                Invoices & payments working
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

