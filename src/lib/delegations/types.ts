/** Keys must match `Delegation.module` and registry. */
export type DelegationModule =
  | "admissions"
  | "polls"
  | "fundraising"
  | "meetings"
  | "academic_calendar"
  | "documents"
  | "supplies"
  | "store"
  | "reports"
  | "staff_attendance"
  | "invitations"
  | "email"
  | "fees"
  | "expenses"
  | "students"
  | "grades"
  | "subjects"
  | "curriculum"
  | "timetable"
  | "academic_periods"
  | "promotions";

export type DelegationStatus = "active" | "expired" | "revoked";

export type DelegationDTO = {
  id: string;
  schoolId: string;
  staffUserId: string;
  staffTeacherId: string | null;
  module: DelegationModule;
  preset: string;
  permissions: string[];
  status: DelegationStatus;
  startsAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revokeReason: string | null;
  grantedByUserId: string;
  grantNote: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DelegationNavItem = {
  module: DelegationModule;
  label: string;
  href: string;
  permissions: string[];
  expiresAt: string | null;
};
