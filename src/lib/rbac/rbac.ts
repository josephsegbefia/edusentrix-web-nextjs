import type { MembershipRole } from "@/lib/roles";

export const TEACHER_SUBROLES = [
  "homeroom_teacher",
  "exam_officer",
  "department_lead",
  "class_coordinator",
  "club_patron",
] as const;

export type TeacherSubrole = (typeof TEACHER_SUBROLES)[number];

export const PERMISSIONS = {
  paymentsView: "payments.view",
  paymentsManage: "payments.manage",
  paymentsApprovePayoutChange: "payments.approve_payout_change",
  dashboardView: "teacher.dashboard.view",
  classesView: "teacher.classes.view",
  scheduleView: "teacher.schedule.view",
  studentsView: "teacher.students.view",
  assignmentsView: "teacher.assignments.view",
  assignmentsCreate: "teacher.assignments.create",
  assignmentsGrade: "teacher.assignments.grade",
  assignmentsPublish: "teacher.assignments.publish",
  gradebookView: "teacher.gradebook.view",
  gradebookRecord: "teacher.gradebook.record",
  gradebookPublish: "teacher.gradebook.publish",
  gradebookExport: "teacher.gradebook.export",
  gradebookLock: "teacher.gradebook.lock",
  attendanceHomeroom: "teacher.attendance.homeroom",
  attendancePeriod: "teacher.attendance.period",
  attendanceReview: "teacher.attendance.review",
  attendanceNotify: "teacher.attendance.notify",
  noticesView: "teacher.communication.notices.view",
  noticesPublish: "teacher.communication.notices.publish",
  messagesView: "teacher.communication.messages.view",
  messagesSend: "teacher.communication.messages.send",
  escalationsCreate: "teacher.communication.escalations.create",
  analyticsView: "teacher.analytics.view",
  analyticsAtRisk: "teacher.analytics.at_risk.view",
  journalView: "teacher.journal.view",
  journalWrite: "teacher.journal.write",
  resourcesView: "teacher.resources.view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

const BASE_ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  teacher: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.classesView,
    PERMISSIONS.scheduleView,
    PERMISSIONS.studentsView,
    PERMISSIONS.assignmentsView,
    PERMISSIONS.assignmentsCreate,
    PERMISSIONS.assignmentsGrade,
    PERMISSIONS.assignmentsPublish,
    PERMISSIONS.gradebookView,
    PERMISSIONS.gradebookRecord,
    PERMISSIONS.attendancePeriod,
    PERMISSIONS.noticesView,
    PERMISSIONS.noticesPublish,
    PERMISSIONS.messagesView,
    PERMISSIONS.messagesSend,
    PERMISSIONS.escalationsCreate,
    PERMISSIONS.analyticsView,
    PERMISSIONS.resourcesView,
    PERMISSIONS.journalView,
    PERMISSIONS.journalWrite, // All teachers can create lesson notes
  ],
  school_admin: ALL_PERMISSIONS,
  billing_owner: [
    PERMISSIONS.paymentsView,
    PERMISSIONS.paymentsManage,
    PERMISSIONS.paymentsApprovePayoutChange,
  ],
  bursar: [],
  staff: [],
  parent: [],
  student: [],
};

const SUBROLE_PERMISSIONS: Record<TeacherSubrole, Permission[]> = {
  homeroom_teacher: [
    PERMISSIONS.attendanceHomeroom,
    PERMISSIONS.attendanceReview,
    PERMISSIONS.attendanceNotify,
    PERMISSIONS.analyticsAtRisk,
    PERMISSIONS.journalWrite,
    PERMISSIONS.messagesSend,
  ],
  exam_officer: [
    PERMISSIONS.gradebookLock,
    PERMISSIONS.gradebookExport,
    PERMISSIONS.gradebookPublish,
  ],
  department_lead: [
    PERMISSIONS.analyticsView,
    PERMISSIONS.assignmentsPublish,
  ],
  class_coordinator: [
    PERMISSIONS.analyticsView,
    PERMISSIONS.attendanceReview,
  ],
  club_patron: [
    PERMISSIONS.noticesPublish,
    PERMISSIONS.messagesSend,
  ],
};

export function isTeacherSubrole(value: string): value is TeacherSubrole {
  return (TEACHER_SUBROLES as readonly string[]).includes(value);
}

export function resolvePermissions(input: {
  roles?: MembershipRole[];
  subroles?: string[];
}): Permission[] {
  const { roles = [], subroles = [] } = input;
  const resolved = new Set<Permission>();

  for (const role of roles) {
    const perms = BASE_ROLE_PERMISSIONS[role] || [];
    for (const perm of perms) resolved.add(perm);
  }

  for (const subrole of subroles) {
    if (!isTeacherSubrole(subrole)) continue;
    const perms = SUBROLE_PERMISSIONS[subrole] || [];
    for (const perm of perms) resolved.add(perm);
  }

  return Array.from(resolved);
}

export function hasPermission(
  permissions: Permission[] | undefined,
  permission: Permission
): boolean {
  return permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(
  permissions: Permission[] | undefined,
  required: Permission[]
): boolean {
  if (!permissions || required.length === 0) return false;
  return required.some((perm) => permissions.includes(perm));
}

export function hasAllPermissions(
  permissions: Permission[] | undefined,
  required: Permission[]
): boolean {
  if (!permissions || required.length === 0) return false;
  return required.every((perm) => permissions.includes(perm));
}
