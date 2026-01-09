"use client";

import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  usePeriodStatus,
  useCanCreateInvoices,
  useCanRecordAssessments,
  useCanCreateAssignments,
  useIsPeriodExpired,
  useIsInGracePeriod,
} from "@/hooks/admin/usePeriodStatus";
import { AlertCircle, Calendar, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Re-export hooks for convenience
export {
  useCanCreateInvoices,
  useCanRecordAssessments,
  useCanCreateAssignments,
  useIsPeriodExpired,
  useIsInGracePeriod,
};

type BlockedAlertProps = {
  operation: "invoices" | "assessments" | "assignments";
  className?: string;
};

const operationMessages: Record<
  BlockedAlertProps["operation"],
  {
    title: string;
    blockedMessage: string;
    graceMessage: string;
    useHook: () => boolean;
  }
> = {
  invoices: {
    title: "Invoice Creation",
    blockedMessage:
      "You cannot create new invoices without an active academic period. Please create a new period to continue.",
    graceMessage:
      "You're in a grace period. Invoices can still be created, but please set up a new academic period soon.",
    useHook: useCanCreateInvoices,
  },
  assessments: {
    title: "Assessment Recording",
    blockedMessage:
      "You cannot record assessments or grades without an active academic period. Please create a new period to continue.",
    graceMessage:
      "Assessment recording requires an active academic period. Please create a new period.",
    useHook: useCanRecordAssessments,
  },
  assignments: {
    title: "Teacher Assignments",
    blockedMessage:
      "You cannot create teacher assignments without an active academic period. Please create a new period to continue.",
    graceMessage:
      "You're in a grace period. Assignments can still be created, but please set up a new academic period soon.",
    useHook: useCanCreateAssignments,
  },
};

export function PeriodBlockedAlert({ operation, className }: BlockedAlertProps) {
  const { data: periodStatus, isLoading } = usePeriodStatus();

  if (isLoading || !periodStatus) return null;

  const { status, warningLevel } = periodStatus;
  const config = operationMessages[operation];
  const canPerform = config.useHook();
  const isGrace = status === "grace_period";

  // Don't show anything if operation is allowed and not in grace period
  if (canPerform && !isGrace) return null;

  // Don't show for fully operational states
  if (warningLevel === "none") return null;

  const isBlocked = !canPerform;
  const message = isBlocked ? config.blockedMessage : config.graceMessage;

  return (
    <Alert
      variant={isBlocked ? "destructive" : "default"}
      className={cn(
        "relative overflow-hidden",
        isBlocked
          ? "border-red-400/40 bg-red-500/10"
          : "border-amber-400/40 bg-amber-500/10",
        className
      )}
    >
      <AlertCircle
        className={cn(
          "h-4 w-4",
          isBlocked ? "text-red-400" : "text-amber-400"
        )}
      />
      <AlertTitle
        className={cn(
          "font-semibold",
          isBlocked ? "text-red-100" : "text-amber-100"
        )}
      >
        {isBlocked
          ? `${config.title} Blocked`
          : `${config.title} — Grace Period`}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p
          className={cn(
            "text-sm",
            isBlocked ? "text-red-100/80" : "text-amber-100/80"
          )}
        >
          {message}
        </p>
        <Button
          asChild
          size="sm"
          className={cn(
            "gap-1",
            isBlocked
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-amber-500 hover:bg-amber-600 text-black"
          )}
        >
          <Link href="/admin">
            <Calendar className="h-3.5 w-3.5" />
            Create Academic Period
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook to check if an operation is blocked and get a message
 */
export function useOperationBlocked(
  operation: "invoices" | "assessments" | "assignments"
): {
  isBlocked: boolean;
  isGrace: boolean;
  message: string | null;
} {
  const { data: periodStatus } = usePeriodStatus();

  if (!periodStatus) {
    return { isBlocked: false, isGrace: false, message: null };
  }

  const { status, canCreateInvoices, canRecordAssessments, canCreateAssignments } =
    periodStatus;
  const isGrace = status === "grace_period";

  let canPerform = true;
  let blockedMessage = "";
  let graceMessage = "";

  switch (operation) {
    case "invoices":
      canPerform = canCreateInvoices;
      blockedMessage =
        "Cannot create invoices without an active academic period.";
      graceMessage =
        "Invoice creation is in grace period. Create a new academic period soon.";
      break;
    case "assessments":
      canPerform = canRecordAssessments;
      blockedMessage =
        "Cannot record assessments without an active academic period.";
      graceMessage =
        "Assessment recording requires an active academic period.";
      break;
    case "assignments":
      canPerform = canCreateAssignments;
      blockedMessage =
        "Cannot create assignments without an active academic period.";
      graceMessage =
        "Assignment creation is in grace period. Create a new academic period soon.";
      break;
  }

  const isBlocked = !canPerform;
  const message = isBlocked ? blockedMessage : isGrace ? graceMessage : null;

  return { isBlocked, isGrace: isGrace && canPerform, message };
}

