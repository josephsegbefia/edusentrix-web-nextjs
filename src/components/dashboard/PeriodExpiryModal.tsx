"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  usePeriodStatus,
  type PeriodStatus,
} from "@/hooks/admin/usePeriodStatus";
import {
  AlertCircle,
  Calendar,
  Clock,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PeriodExpiryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePeriod: () => void;
};

function OperationStatus({
  label,
  allowed,
  warning,
}: {
  label: string;
  allowed: boolean;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/10 last:border-b-0">
      <span className="text-sm text-white/80">{label}</span>
      <div className="flex items-center gap-1.5">
        {allowed ? (
          warning ? (
            <>
              <MinusCircle className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-amber-300">With warnings</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-emerald-300">Available</span>
            </>
          )
        ) : (
          <>
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-xs text-red-300">Blocked</span>
          </>
        )}
      </div>
    </div>
  );
}

function getStatusInfo(status: PeriodStatus | undefined): {
  title: string;
  description: string;
  Icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  gradientFrom: string;
} {
  switch (status) {
    case "no_period":
      return {
        title: "No Academic Period Created",
        description:
          "Your school needs an academic period to function properly. Create your first period to start managing students, fees, and academic records.",
        Icon: Calendar,
        iconBg: "bg-red-500/20 border border-red-400/30",
        iconColor: "text-red-300",
        gradientFrom: "from-red-500/20",
      };
    case "expired":
      return {
        title: "Academic Period Has Ended",
        description:
          "Your academic period has expired. Some critical operations are now blocked. Create a new period immediately to restore full functionality.",
        Icon: AlertCircle,
        iconBg: "bg-red-500/20 border border-red-400/30",
        iconColor: "text-red-300",
        gradientFrom: "from-red-500/20",
      };
    case "grace_period":
      return {
        title: "Academic Period Grace Period",
        description:
          "Your academic period recently ended. You're in a 7-day grace period where most operations still work. Create a new period before the grace period expires.",
        Icon: AlertTriangle,
        iconBg: "bg-orange-500/20 border border-orange-400/30",
        iconColor: "text-orange-300",
        gradientFrom: "from-orange-500/20",
      };
    case "expiring_critical":
      return {
        title: "Period Expires Very Soon",
        description:
          "Your academic period is about to end. Create a new period now to ensure uninterrupted operations.",
        Icon: Clock,
        iconBg: "bg-red-500/20 border border-red-400/30",
        iconColor: "text-red-300",
        gradientFrom: "from-red-500/20",
      };
    default:
      return {
        title: "Academic Period Status",
        description: "Review your academic period status.",
        Icon: Calendar,
        iconBg: "bg-blue-500/20 border border-blue-400/30",
        iconColor: "text-blue-300",
        gradientFrom: "from-blue-500/20",
      };
  }
}

export function PeriodExpiryModal({
  open,
  onOpenChange,
  onCreatePeriod,
}: PeriodExpiryModalProps) {
  const { data: periodStatus, isLoading } = usePeriodStatus();

  if (isLoading || !periodStatus) return null;

  const {
    status,
    currentPeriod,
    daysUntilExpiry,
    daysSinceExpiry,
    canCreateInvoices,
    canRecordAssessments,
    canCreateAssignments,
  } = periodStatus;

  const statusInfo = getStatusInfo(status);
  const { Icon, iconBg, iconColor, title, description, gradientFrom } =
    statusInfo;

  // Determine if this modal should be shown automatically
  const shouldAutoShow =
    status === "no_period" ||
    status === "expired" ||
    status === "expiring_critical";

  // Don't allow closing for critical statuses
  const canClose = status !== "no_period" && status !== "expired";

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !canClose) {
      // Don't close if it's a critical status
      return;
    }
    onOpenChange(newOpen);
  };

  const handleCreatePeriod = () => {
    onCreatePeriod();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "max-w-lg border border-white/10 bg-slate-950/95 text-slate-50 shadow-2xl shadow-black/50",
          !canClose && "[&>button]:hidden" // Hide close button if can't close
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-linear-to-br via-transparent to-transparent opacity-50",
            gradientFrom
          )}
          aria-hidden="true"
        />

        <DialogHeader className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn("p-3 rounded-xl", iconBg)}>
              <Icon className={cn("h-6 w-6", iconColor)} />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                {title}
              </DialogTitle>
              {currentPeriod && (
                <p className="text-xs text-white/50 mt-0.5">
                  {currentPeriod.term} {currentPeriod.yearLabel}
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="text-sm text-white/70">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="relative z-10 space-y-4">
          {/* Time indicator */}
          {(daysUntilExpiry !== null || daysSinceExpiry !== null) && (
            <div
              className={cn(
                "rounded-xl border p-4",
                status === "expired" || status === "no_period"
                  ? "border-red-400/30 bg-red-500/10"
                  : status === "grace_period"
                  ? "border-orange-400/30 bg-orange-500/10"
                  : "border-amber-400/30 bg-amber-500/10"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">
                  {daysSinceExpiry !== null
                    ? "Period ended"
                    : "Time remaining"}
                </span>
                <span
                  className={cn(
                    "text-lg font-bold",
                    status === "expired" || status === "no_period"
                      ? "text-red-300"
                      : status === "grace_period"
                      ? "text-orange-300"
                      : "text-amber-300"
                  )}
                >
                  {daysSinceExpiry !== null
                    ? `${daysSinceExpiry} day${
                        daysSinceExpiry === 1 ? "" : "s"
                      } ago`
                    : `${daysUntilExpiry} day${
                        daysUntilExpiry === 1 ? "" : "s"
                      }`}
                </span>
              </div>
              {status === "grace_period" && daysSinceExpiry !== null && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                    <span>Grace period</span>
                    <span>{7 - daysSinceExpiry} days remaining</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-400 rounded-full transition-all"
                      style={{ width: `${((7 - daysSinceExpiry) / 7) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Operations status */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h4 className="text-sm font-medium text-white/90 mb-3">
              System Operations Status
            </h4>
            <div className="space-y-1">
              <OperationStatus
                label="Create fee invoices"
                allowed={canCreateInvoices}
                warning={status === "grace_period"}
              />
              <OperationStatus
                label="Record assessments & grades"
                allowed={canRecordAssessments}
              />
              <OperationStatus
                label="Create teacher assignments"
                allowed={canCreateAssignments}
                warning={status === "grace_period"}
              />
              <OperationStatus label="View historical data" allowed={true} />
              <OperationStatus
                label="Record payments"
                allowed={true}
                warning={
                  status === "expired" ||
                  status === "grace_period" ||
                  status === "no_period"
                }
              />
              <OperationStatus label="Student & teacher management" allowed={true} />
            </div>
          </div>

          {/* Helpful tips */}
          {currentPeriod && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h4 className="text-sm font-medium text-white/90 mb-2">
                Tip: Creating a New Period
              </h4>
              <ul className="space-y-1.5 text-xs text-white/60">
                <li className="flex items-start gap-2">
                  <span className="text-brand">•</span>
                  You can backdate the start date if the new term has already
                  begun
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand">•</span>
                  Teacher assignments can be carried forward to the new period
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand">•</span>
                  Historical data from the previous period is always preserved
                </li>
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              onClick={handleCreatePeriod}
              className={cn(
                "flex-1 gap-2",
                status === "expired" || status === "no_period"
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : status === "grace_period" || status === "expiring_critical"
                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                  : "bg-brand hover:bg-brand/90 text-black"
              )}
            >
              {status === "no_period"
                ? "Create First Period"
                : "Create New Period"}
              <ChevronRight className="h-4 w-4" />
            </Button>

            {canClose && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
              >
                Later
              </Button>
            )}
          </div>

          {!canClose && (
            <p className="text-xs text-center text-white/40">
              This action is required to continue using the system.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

