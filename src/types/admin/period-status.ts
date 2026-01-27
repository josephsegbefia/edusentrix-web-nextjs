// src/types/admin/period-status.ts

export type PeriodStatus =
  | "active" // Period is active and not expiring soon
  | "expiring_soon" // Period expires within 14 days
  | "expiring_very_soon" // Period expires within 7 days
  | "expiring_critical" // Period expires within 3 days
  | "expired" // Period has ended, no new period set
  | "grace_period" // Period ended within last 7 days (grace period)
  | "no_period"; // No period has ever been created

export type WarningLevel = "none" | "info" | "warning" | "urgent" | "critical";

export type PeriodStatusData = {
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

export type PeriodStatusResponse = {
  success: true;
  data: PeriodStatusData;
};

