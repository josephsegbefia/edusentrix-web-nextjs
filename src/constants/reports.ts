export type ReportCategory =
  | "fees"
  | "students"
  | "teachers"
  | "attendance"
  | "invitations"
  | "academics"
  | "activity";

export type ReportRangeMode = "range" | "all_time" | "period";
export type ReportFormat = "csv" | "pdf";

export type ReportKey =
  | "fees.overview"
  | "fees.defaulters"
  | "fees.payments"
  | "students.roster"
  | "teachers.roster"
  | "teachers.workload"
  | "attendance.summary"
  | "invitations.log"
  | "academics.summary"
  | "activity.log";

export type ReportDefinition = {
  key: ReportKey;
  label: string;
  category: ReportCategory;
  rangeMode: ReportRangeMode;
  formats: ReportFormat[];
  description?: string;
};

export const REPORT_DEFINITIONS: Record<ReportKey, ReportDefinition> = {
  "fees.overview": {
    key: "fees.overview",
    label: "Fees Overview",
    category: "fees",
    rangeMode: "range",
    formats: ["csv"],
    description: "Revenue, billing, and collection summary for the range.",
  },
  "fees.defaulters": {
    key: "fees.defaulters",
    label: "Fee Defaulters",
    category: "fees",
    rangeMode: "range",
    formats: ["csv"],
    description: "Students with outstanding balances and overdue totals.",
  },
  "fees.payments": {
    key: "fees.payments",
    label: "Payments Ledger",
    category: "fees",
    rangeMode: "range",
    formats: ["csv"],
    description: "Completed payments within the selected range.",
  },
  "students.roster": {
    key: "students.roster",
    label: "Student Roster",
    category: "students",
    rangeMode: "all_time",
    formats: ["csv"],
    description: "Active roster with grade, class, and enrollment details.",
  },
  "teachers.roster": {
    key: "teachers.roster",
    label: "Teacher Roster",
    category: "teachers",
    rangeMode: "all_time",
    formats: ["csv"],
    description: "All staff with department and status details.",
  },
  "teachers.workload": {
    key: "teachers.workload",
    label: "Teacher Workload",
    category: "teachers",
    rangeMode: "period",
    formats: ["csv"],
    description: "Assignments count by teacher for the selected period.",
  },
  "attendance.summary": {
    key: "attendance.summary",
    label: "Staff Attendance Summary",
    category: "attendance",
    rangeMode: "range",
    formats: ["csv"],
    description: "Attendance status counts per teacher.",
  },
  "invitations.log": {
    key: "invitations.log",
    label: "Invitations Log",
    category: "invitations",
    rangeMode: "range",
    formats: ["csv"],
    description: "Invitation status activity and resend history.",
  },
  "academics.summary": {
    key: "academics.summary",
    label: "Academics Summary",
    category: "academics",
    rangeMode: "period",
    formats: ["csv"],
    description: "Subject averages and pass rates for the period.",
  },
  "activity.log": {
    key: "activity.log",
    label: "Activity Log",
    category: "activity",
    rangeMode: "range",
    formats: ["csv"],
    description: "System activity entries for audit and oversight.",
  },
};

export const REPORT_DEFINITION_LIST = Object.values(REPORT_DEFINITIONS);
