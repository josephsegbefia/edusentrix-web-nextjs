// src/app/api/admin/periods/status/route.ts
import { NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";

export type PeriodStatus =
  | "active" // Period is active and not expiring soon
  | "expiring_soon" // Period expires within 14 days
  | "expiring_very_soon" // Period expires within 7 days
  | "expiring_critical" // Period expires within 3 days
  | "expired" // Period has ended, no new period set
  | "grace_period" // Period ended within last 7 days (grace period)
  | "no_period"; // No period has ever been created

export type WarningLevel = "none" | "info" | "warning" | "urgent" | "critical";

export type PeriodStatusResponse = {
  success: true;
  data: {
    status: PeriodStatus;
    warningLevel: WarningLevel;
    currentPeriod: {
      id: string;
      yearLabel: string;
      term: string;
      startDate: string;
      endDate: string;
      isCurrent: boolean;
    } | null;
    daysUntilExpiry: number | null;
    daysSinceExpiry: number | null;
    message: string;
    actionRequired: boolean;
    canCreateInvoices: boolean;
    canRecordAssessments: boolean;
    canCreateAssignments: boolean;
  };
};

function getDaysDifference(date1: Date, date2: Date): number {
  const diffTime = date1.getTime() - date2.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getStatusAndLevel(
  daysUntilExpiry: number | null,
  daysSinceExpiry: number | null,
  hasPeriod: boolean
): { status: PeriodStatus; warningLevel: WarningLevel } {
  if (!hasPeriod) {
    return { status: "no_period", warningLevel: "critical" };
  }

  // Period has expired
  if (daysSinceExpiry !== null && daysSinceExpiry > 0) {
    if (daysSinceExpiry <= 7) {
      return { status: "grace_period", warningLevel: "urgent" };
    }
    return { status: "expired", warningLevel: "critical" };
  }

  // Period is active
  if (daysUntilExpiry !== null) {
    if (daysUntilExpiry <= 3) {
      return { status: "expiring_critical", warningLevel: "critical" };
    }
    if (daysUntilExpiry <= 7) {
      return { status: "expiring_very_soon", warningLevel: "urgent" };
    }
    if (daysUntilExpiry <= 14) {
      return { status: "expiring_soon", warningLevel: "warning" };
    }
  }

  return { status: "active", warningLevel: "none" };
}

function getMessage(
  status: PeriodStatus,
  daysUntilExpiry: number | null,
  daysSinceExpiry: number | null,
  periodLabel: string | null
): string {
  switch (status) {
    case "no_period":
      return "No academic period has been created. Create one to start using the system.";
    case "expired":
      return `Your academic period${
        periodLabel ? ` (${periodLabel})` : ""
      } ended ${daysSinceExpiry} day${
        daysSinceExpiry === 1 ? "" : "s"
      } ago. Create a new period to continue operations.`;
    case "grace_period":
      return `Your academic period${
        periodLabel ? ` (${periodLabel})` : ""
      } ended ${daysSinceExpiry} day${
        daysSinceExpiry === 1 ? "" : "s"
      } ago. You're in a grace period — create a new period soon.`;
    case "expiring_critical":
      return `Your academic period${
        periodLabel ? ` (${periodLabel})` : ""
      } ends in ${daysUntilExpiry} day${
        daysUntilExpiry === 1 ? "" : "s"
      }! Create a new period now.`;
    case "expiring_very_soon":
      return `Your academic period${
        periodLabel ? ` (${periodLabel})` : ""
      } ends in ${daysUntilExpiry} days. Prepare your next period.`;
    case "expiring_soon":
      return `Your academic period${
        periodLabel ? ` (${periodLabel})` : ""
      } ends in ${daysUntilExpiry} days. Start planning your next period.`;
    case "active":
      return "Your academic period is active.";
    default:
      return "";
  }
}

export async function GET() {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    // Get current period
    const currentPeriodRaw = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("yearLabel term startDate endDate isCurrent")
      .lean();

    const currentPeriod = Array.isArray(currentPeriodRaw)
      ? currentPeriodRaw[0]
      : currentPeriodRaw;

    const now = new Date();
    let daysUntilExpiry: number | null = null;
    let daysSinceExpiry: number | null = null;
    let periodLabel: string | null = null;

    if (currentPeriod) {
      const endDate = new Date(currentPeriod.endDate);
      periodLabel = `${currentPeriod.term} ${currentPeriod.yearLabel}`;

      if (now > endDate) {
        // Period has expired
        daysSinceExpiry = getDaysDifference(now, endDate);
      } else {
        // Period is still active
        daysUntilExpiry = getDaysDifference(endDate, now);
      }
    }

    const { status, warningLevel } = getStatusAndLevel(
      daysUntilExpiry,
      daysSinceExpiry,
      !!currentPeriod
    );

    const message = getMessage(
      status,
      daysUntilExpiry,
      daysSinceExpiry,
      periodLabel
    );

    // Determine what operations are allowed
    const isFullyOperational =
      status === "active" ||
      status === "expiring_soon" ||
      status === "expiring_very_soon";
    const isGracePeriod =
      status === "grace_period" || status === "expiring_critical";
    const isBlocked = status === "expired" || status === "no_period";

    const response: PeriodStatusResponse = {
      success: true,
      data: {
        status,
        warningLevel,
        currentPeriod: currentPeriod
          ? {
              id: String((currentPeriod as any)._id),
              yearLabel: currentPeriod.yearLabel,
              term: currentPeriod.term,
              startDate: new Date(currentPeriod.startDate).toISOString(),
              endDate: new Date(currentPeriod.endDate).toISOString(),
              isCurrent: currentPeriod.isCurrent,
            }
          : null,
        daysUntilExpiry,
        daysSinceExpiry,
        message,
        actionRequired: warningLevel !== "none",
        // Operations allowed
        canCreateInvoices: isFullyOperational || isGracePeriod,
        canRecordAssessments: isFullyOperational,
        canCreateAssignments: isFullyOperational || isGracePeriod,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching period status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch period status" },
      { status: 500 }
    );
  }
}

