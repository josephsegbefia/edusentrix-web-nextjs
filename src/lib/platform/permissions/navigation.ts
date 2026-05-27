import type { PlatformPermissionKey } from "@/lib/platform/permissions/registry";

export type PlatformRouteAccessRule = {
  href: string;
  exact?: boolean;
  requiredPermissions: PlatformPermissionKey[];
};

export const PLATFORM_ROUTE_ACCESS_RULES: PlatformRouteAccessRule[] = [
  {
    href: "/platform",
    exact: true,
    requiredPermissions: ["platform.schools.read"],
  },
  {
    href: "/platform/applications",
    requiredPermissions: ["platform.applications.read"],
  },
  {
    href: "/platform/demo-leads",
    requiredPermissions: ["platform.applications.read"],
  },
  {
    href: "/platform/proposals",
    requiredPermissions: ["platform.proposals.read"],
  },
  {
    href: "/platform/schools",
    requiredPermissions: ["platform.schools.read"],
  },
  {
    href: "/platform/staff",
    requiredPermissions: ["platform.staff.read"],
  },
  {
    href: "/platform/users",
    requiredPermissions: ["platform.staff.read"],
  },
  {
    href: "/platform/pilot",
    requiredPermissions: ["platform.schools.read"],
  },
  {
    href: "/platform/delegations",
    requiredPermissions: ["platform.implementation.assignTasks"],
  },
  {
    href: "/platform/tasks",
    requiredPermissions: ["platform.implementation.read"],
  },
  {
    href: "/platform/schools/new",
    requiredPermissions: ["platform.schools.create"],
  },
  {
    href: "/platform/subscriptions",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/subscription-plans",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/subscription-billing",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/subscription-notifications",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/subscriptions/schools",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/subscriptions/payment-charges",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/subscriptions/add-ons",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/subscriptions/usage",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/subscriptions/invoices",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/subscriptions/leakage",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/subscriptions/settings",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/reconciliation",
    requiredPermissions: ["platform.billing.read"],
  },
  {
    href: "/platform/email",
    requiredPermissions: ["platform.support.read"],
  },
  {
    href: "/platform/emails",
    requiredPermissions: ["platform.support.read"],
  },
  {
    href: "/platform/webhooks",
    requiredPermissions: ["platform.system.settings.read"],
  },
  {
    href: "/platform/audit",
    requiredPermissions: ["platform.audit.read"],
  },
  {
    href: "/platform/flags",
    requiredPermissions: ["platform.system.featureFlags.read"],
  },
  {
    href: "/platform/leo",
    requiredPermissions: ["platform.system.settings.read"],
  },
  {
    href: "/platform/settings",
    requiredPermissions: ["platform.system.settings.read"],
  },
];

export function hasAnyRequiredPlatformPermission(
  actorPermissions: readonly PlatformPermissionKey[],
  requiredPermissions: readonly PlatformPermissionKey[],
  isLegacyPlatformAdmin = false
) {
  if (isLegacyPlatformAdmin) {
    return true;
  }

  if (requiredPermissions.length === 0) {
    return true;
  }

  const permissionSet = new Set(actorPermissions);
  return requiredPermissions.some((permission) => permissionSet.has(permission));
}

export function getPlatformRouteAccessRule(pathname: string) {
  return PLATFORM_ROUTE_ACCESS_RULES.find((rule) =>
    rule.exact ? pathname === rule.href : pathname === rule.href || pathname.startsWith(`${rule.href}/`)
  );
}
