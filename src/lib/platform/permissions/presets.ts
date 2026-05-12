import {
  ALL_PLATFORM_PERMISSION_KEYS,
  type PlatformPermissionKey,
} from "@/lib/platform/permissions/registry";

export const PLATFORM_STAFF_ROLE_PRESETS = [
  "platform_owner",
  "platform_admin",
  "platform_operations_manager",
  "implementation_manager",
  "implementation_specialist",
  "data_migration_specialist",
  "academic_setup_specialist",
  "support_agent",
  "technical_support_specialist",
  "training_coordinator",
  "finance_officer",
  "payment_operations_officer",
  "applications_officer",
  "platform_auditor",
  "custom",
] as const;

export type PlatformStaffRolePreset = (typeof PLATFORM_STAFF_ROLE_PRESETS)[number];

export type PlatformRolePresetDefinition = {
  key: PlatformStaffRolePreset;
  label: string;
  description: string;
  defaultAccessMode: "all_schools" | "delegated_only";
  permissions: PlatformPermissionKey[];
};

export const PLATFORM_ROLE_PRESETS: Record<
  PlatformStaffRolePreset,
  PlatformRolePresetDefinition
> = {
  platform_owner: {
    key: "platform_owner",
    label: "Platform Owner",
    description: "Full owner-level access to platform operations.",
    defaultAccessMode: "all_schools",
    permissions: ALL_PLATFORM_PERMISSION_KEYS,
  },
  platform_admin: {
    key: "platform_admin",
    label: "Platform Administrator",
    description: "Broad operational access excluding permanent school deletion and critical system settings by default.",
    defaultAccessMode: "all_schools",
    permissions: [
      "platform.schools.read",
      "platform.schools.create",
      "platform.schools.update",
      "platform.schools.activate",
      "platform.schools.suspend",
      "platform.implementation.read",
      "platform.implementation.manage",
      "platform.implementation.assignTasks",
      "platform.implementation.executeSetup",
      "platform.implementation.goLiveReview",
      "platform.staff.read",
      "platform.staff.invite",
      "platform.billing.read",
      "platform.billing.manage",
      "platform.subscriptions.manage",
      "platform.paymentSetup.review",
      "platform.audit.read",
      "platform.support.read",
      "platform.support.respond",
      "platform.support.escalate",
      "platform.applications.read",
      "platform.applications.approve",
      "platform.applications.reject",
    ],
  },
  platform_operations_manager: {
    key: "platform_operations_manager",
    label: "Platform Operations Manager",
    description: "Oversees day-to-day implementation, support, and go-live readiness.",
    defaultAccessMode: "all_schools",
    permissions: [
      "platform.schools.read",
      "platform.schools.update",
      "platform.implementation.read",
      "platform.implementation.manage",
      "platform.implementation.assignTasks",
      "platform.implementation.goLiveReview",
      "platform.support.read",
      "platform.support.escalate",
      "platform.audit.read",
    ],
  },
  implementation_manager: {
    key: "implementation_manager",
    label: "Implementation Manager",
    description: "Manages setup projects, task assignment, and implementation review.",
    defaultAccessMode: "all_schools",
    permissions: [
      "platform.schools.read",
      "platform.schools.update",
      "platform.implementation.read",
      "platform.implementation.manage",
      "platform.implementation.assignTasks",
      "platform.implementation.executeSetup",
      "platform.implementation.goLiveReview",
      "platform.support.read",
      "platform.audit.read",
    ],
  },
  implementation_specialist: {
    key: "implementation_specialist",
    label: "Implementation Specialist",
    description: "Executes delegated school setup work.",
    defaultAccessMode: "delegated_only",
    permissions: [
      "platform.schools.read",
      "platform.implementation.read",
      "platform.implementation.executeSetup",
      "platform.support.read",
    ],
  },
  data_migration_specialist: {
    key: "data_migration_specialist",
    label: "Data Migration Specialist",
    description: "Handles import and migration work for delegated schools.",
    defaultAccessMode: "delegated_only",
    permissions: [
      "platform.schools.read",
      "platform.implementation.read",
      "platform.implementation.executeSetup",
    ],
  },
  academic_setup_specialist: {
    key: "academic_setup_specialist",
    label: "Academic Setup Specialist",
    description: "Configures curriculum, academic periods, subjects, and schedules.",
    defaultAccessMode: "delegated_only",
    permissions: [
      "platform.schools.read",
      "platform.implementation.read",
      "platform.implementation.executeSetup",
      "platform.implementation.manage",
    ],
  },
  support_agent: {
    key: "support_agent",
    label: "Support Agent",
    description: "Handles school support requests and communications.",
    defaultAccessMode: "delegated_only",
    permissions: [
      "platform.schools.read",
      "platform.support.read",
      "platform.support.respond",
    ],
  },
  technical_support_specialist: {
    key: "technical_support_specialist",
    label: "Technical Support Specialist",
    description: "Investigates technical issues and escalates support cases.",
    defaultAccessMode: "delegated_only",
    permissions: [
      "platform.schools.read",
      "platform.support.read",
      "platform.support.respond",
      "platform.support.escalate",
      "platform.audit.read",
    ],
  },
  training_coordinator: {
    key: "training_coordinator",
    label: "Training Coordinator",
    description: "Coordinates onboarding and school training milestones.",
    defaultAccessMode: "delegated_only",
    permissions: [
      "platform.schools.read",
      "platform.implementation.read",
      "platform.implementation.manage",
      "platform.support.read",
    ],
  },
  finance_officer: {
    key: "finance_officer",
    label: "Finance Officer",
    description: "Manages platform billing, subscriptions, and payment setup review.",
    defaultAccessMode: "all_schools",
    permissions: [
      "platform.schools.read",
      "platform.billing.read",
      "platform.billing.manage",
      "platform.subscriptions.manage",
      "platform.paymentSetup.review",
      "platform.audit.read",
    ],
  },
  payment_operations_officer: {
    key: "payment_operations_officer",
    label: "Payment Operations Officer",
    description: "Reviews payment setup and transaction operations.",
    defaultAccessMode: "all_schools",
    permissions: [
      "platform.schools.read",
      "platform.billing.read",
      "platform.paymentSetup.review",
      "platform.audit.read",
    ],
  },
  applications_officer: {
    key: "applications_officer",
    label: "Applications Officer",
    description: "Reviews incoming school applications and demo requests.",
    defaultAccessMode: "all_schools",
    permissions: [
      "platform.schools.read",
      "platform.applications.read",
      "platform.applications.approve",
      "platform.applications.reject",
    ],
  },
  platform_auditor: {
    key: "platform_auditor",
    label: "Platform Auditor",
    description: "Read-only oversight for schools, billing summaries, and audit logs.",
    defaultAccessMode: "all_schools",
    permissions: [
      "platform.schools.read",
      "platform.billing.read",
      "platform.audit.read",
    ],
  },
  custom: {
    key: "custom",
    label: "Custom Role",
    description: "Manually selected platform permissions.",
    defaultAccessMode: "delegated_only",
    permissions: [],
  },
};

export function getPresetPermissions(preset: PlatformStaffRolePreset) {
  return PLATFORM_ROLE_PRESETS[preset]?.permissions ?? [];
}
