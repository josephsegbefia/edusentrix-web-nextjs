export type PlatformPermissionRisk = "low" | "medium" | "high" | "critical";

export type PlatformPermissionCategory =
  | "Schools"
  | "Implementation"
  | "EduSentrix Staff"
  | "Billing & Subscriptions"
  | "Payments"
  | "Audit"
  | "Support"
  | "Applications"
  | "System";

export const PLATFORM_PERMISSION_KEYS = [
  "platform.schools.read",
  "platform.schools.create",
  "platform.schools.update",
  "platform.schools.activate",
  "platform.schools.suspend",
  "platform.schools.delete",
  "platform.implementation.read",
  "platform.implementation.manage",
  "platform.implementation.assignTasks",
  "platform.implementation.executeSetup",
  "platform.implementation.goLiveReview",
  "platform.staff.read",
  "platform.staff.invite",
  "platform.staff.manageRoles",
  "platform.staff.suspend",
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
  "platform.system.featureFlags.read",
  "platform.system.featureFlags.manage",
  "platform.system.settings.read",
  "platform.system.settings.manage",
] as const;

export type PlatformPermissionKey = (typeof PLATFORM_PERMISSION_KEYS)[number];

export type PlatformPermissionDefinition = {
  key: PlatformPermissionKey;
  label: string;
  description: string;
  category: PlatformPermissionCategory;
  riskLevel: PlatformPermissionRisk;
  assignable: boolean;
};

export const PLATFORM_PERMISSION_REGISTRY: Record<
  PlatformPermissionKey,
  PlatformPermissionDefinition
> = {
  "platform.schools.read": {
    key: "platform.schools.read",
    label: "View Schools",
    description: "View school list, school profiles, setup status, subscription status, and school metadata.",
    category: "Schools",
    riskLevel: "low",
    assignable: true,
  },
  "platform.schools.create": {
    key: "platform.schools.create",
    label: "Create Schools",
    description: "Create new schools directly from the platform operations console.",
    category: "Schools",
    riskLevel: "high",
    assignable: true,
  },
  "platform.schools.update": {
    key: "platform.schools.update",
    label: "Update School Details",
    description: "Edit school profile, contact details, operational metadata, and setup information.",
    category: "Schools",
    riskLevel: "medium",
    assignable: true,
  },
  "platform.schools.activate": {
    key: "platform.schools.activate",
    label: "Activate Schools",
    description: "Activate schools and mark them ready or live.",
    category: "Schools",
    riskLevel: "high",
    assignable: true,
  },
  "platform.schools.suspend": {
    key: "platform.schools.suspend",
    label: "Suspend Schools",
    description: "Suspend a school’s access to EduSentrix. This must be audited.",
    category: "Schools",
    riskLevel: "critical",
    assignable: true,
  },
  "platform.schools.delete": {
    key: "platform.schools.delete",
    label: "Delete Schools",
    description: "Permanently delete or queue deletion for a school. Extremely restricted.",
    category: "Schools",
    riskLevel: "critical",
    assignable: true,
  },
  "platform.implementation.read": {
    key: "platform.implementation.read",
    label: "View Implementation Workspaces",
    description: "View school setup workspaces, onboarding checklists, assigned staff, blockers, and go-live readiness.",
    category: "Implementation",
    riskLevel: "low",
    assignable: true,
  },
  "platform.implementation.manage": {
    key: "platform.implementation.manage",
    label: "Manage Implementation Workspaces",
    description: "Update implementation status, setup checklist, go-live readiness, and onboarding notes.",
    category: "Implementation",
    riskLevel: "medium",
    assignable: true,
  },
  "platform.implementation.assignTasks": {
    key: "platform.implementation.assignTasks",
    label: "Assign Implementation Tasks",
    description: "Assign setup tasks to EduSentrix staff.",
    category: "Implementation",
    riskLevel: "medium",
    assignable: true,
  },
  "platform.implementation.executeSetup": {
    key: "platform.implementation.executeSetup",
    label: "Execute School Setup",
    description: "Create school setup data such as academic periods, grades, classes, subjects, people, fees, schedules, and invoices.",
    category: "Implementation",
    riskLevel: "high",
    assignable: true,
  },
  "platform.implementation.goLiveReview": {
    key: "platform.implementation.goLiveReview",
    label: "Approve Go-Live Readiness",
    description: "Mark a school ready for go-live after setup checks.",
    category: "Implementation",
    riskLevel: "high",
    assignable: true,
  },
  "platform.staff.read": {
    key: "platform.staff.read",
    label: "View EduSentrix Staff",
    description: "View internal EduSentrix staff accounts, roles, permissions, and access status.",
    category: "EduSentrix Staff",
    riskLevel: "low",
    assignable: true,
  },
  "platform.staff.invite": {
    key: "platform.staff.invite",
    label: "Invite EduSentrix Staff",
    description: "Invite new EduSentrix workers to the platform operations console.",
    category: "EduSentrix Staff",
    riskLevel: "high",
    assignable: true,
  },
  "platform.staff.manageRoles": {
    key: "platform.staff.manageRoles",
    label: "Manage Staff Roles & Permissions",
    description: "Change staff roles, permission presets, and custom permissions.",
    category: "EduSentrix Staff",
    riskLevel: "critical",
    assignable: true,
  },
  "platform.staff.suspend": {
    key: "platform.staff.suspend",
    label: "Suspend EduSentrix Staff",
    description: "Suspend internal staff access.",
    category: "EduSentrix Staff",
    riskLevel: "critical",
    assignable: true,
  },
  "platform.billing.read": {
    key: "platform.billing.read",
    label: "View Billing",
    description: "View billing overview, school billing status, revenue summaries, and subscription state.",
    category: "Billing & Subscriptions",
    riskLevel: "low",
    assignable: true,
  },
  "platform.billing.manage": {
    key: "platform.billing.manage",
    label: "Manage Billing",
    description: "Update billing records, billing settings, cost records, and billing operations.",
    category: "Billing & Subscriptions",
    riskLevel: "high",
    assignable: true,
  },
  "platform.subscriptions.manage": {
    key: "platform.subscriptions.manage",
    label: "Manage Subscriptions",
    description: "Assign, renew, cancel, expire, or adjust school subscription plans.",
    category: "Billing & Subscriptions",
    riskLevel: "high",
    assignable: true,
  },
  "platform.paymentSetup.review": {
    key: "platform.paymentSetup.review",
    label: "Review Payment Setup",
    description: "Review school payment setup, bank details, Paystack readiness, and payout proposals.",
    category: "Payments",
    riskLevel: "high",
    assignable: true,
  },
  "platform.audit.read": {
    key: "platform.audit.read",
    label: "View Audit Logs",
    description: "View immutable platform audit trails and sensitive operation history.",
    category: "Audit",
    riskLevel: "high",
    assignable: true,
  },
  "platform.support.read": {
    key: "platform.support.read",
    label: "View Support Requests",
    description: "View support tickets, email inbox items, school issues, and support history.",
    category: "Support",
    riskLevel: "low",
    assignable: true,
  },
  "platform.support.respond": {
    key: "platform.support.respond",
    label: "Respond to Support Requests",
    description: "Reply to support requests, update tickets, and manage support communication.",
    category: "Support",
    riskLevel: "medium",
    assignable: true,
  },
  "platform.support.escalate": {
    key: "platform.support.escalate",
    label: "Escalate Support Requests",
    description: "Escalate support issues to technical or operations teams.",
    category: "Support",
    riskLevel: "medium",
    assignable: true,
  },
  "platform.applications.read": {
    key: "platform.applications.read",
    label: "View Applications",
    description: "View school applications, demo leads, and signup requests.",
    category: "Applications",
    riskLevel: "low",
    assignable: true,
  },
  "platform.applications.approve": {
    key: "platform.applications.approve",
    label: "Approve Applications",
    description: "Approve school applications and create schools from applications.",
    category: "Applications",
    riskLevel: "high",
    assignable: true,
  },
  "platform.applications.reject": {
    key: "platform.applications.reject",
    label: "Reject Applications",
    description: "Reject school applications with an optional reason.",
    category: "Applications",
    riskLevel: "medium",
    assignable: true,
  },
  "platform.system.featureFlags.read": {
    key: "platform.system.featureFlags.read",
    label: "View Feature Flags",
    description: "View platform feature flags and rollout settings.",
    category: "System",
    riskLevel: "medium",
    assignable: true,
  },
  "platform.system.featureFlags.manage": {
    key: "platform.system.featureFlags.manage",
    label: "Manage Feature Flags",
    description: "Enable or disable platform feature flags.",
    category: "System",
    riskLevel: "critical",
    assignable: true,
  },
  "platform.system.settings.read": {
    key: "platform.system.settings.read",
    label: "View Platform Settings",
    description: "View platform-wide settings.",
    category: "System",
    riskLevel: "medium",
    assignable: true,
  },
  "platform.system.settings.manage": {
    key: "platform.system.settings.manage",
    label: "Manage Platform Settings",
    description: "Update platform-wide settings.",
    category: "System",
    riskLevel: "critical",
    assignable: true,
  },
};

export const ALL_PLATFORM_PERMISSION_KEYS = [...PLATFORM_PERMISSION_KEYS];

export function isPlatformPermissionKey(value: string): value is PlatformPermissionKey {
  return value in PLATFORM_PERMISSION_REGISTRY;
}

export function validatePlatformPermissionKeys(values: string[]) {
  const invalid = values.filter((value) => !isPlatformPermissionKey(value));
  return {
    ok: invalid.length === 0,
    invalid,
    permissions: values.filter(isPlatformPermissionKey),
  };
}
