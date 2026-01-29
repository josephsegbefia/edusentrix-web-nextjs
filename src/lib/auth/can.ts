import type { Permission } from "@/lib/rbac";

export function can(
  permissions: Permission[] | undefined,
  permission: Permission
): boolean {
  return permissions?.includes(permission) ?? false;
}

export function canAny(
  permissions: Permission[] | undefined,
  required: Permission[]
): boolean {
  if (!permissions || required.length === 0) return false;
  return required.some((perm) => permissions.includes(perm));
}

export function canAll(
  permissions: Permission[] | undefined,
  required: Permission[]
): boolean {
  if (!permissions || required.length === 0) return false;
  return required.every((perm) => permissions.includes(perm));
}
