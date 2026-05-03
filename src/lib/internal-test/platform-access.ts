import type { IUser } from "@/models/User";
import { PLATFORM_INTERNAL_TEST_MANAGE } from "./constants";

/**
 * When `platformPermissionKeys` is empty/undefined, full platform admin access is preserved
 * (legacy). When the array is non-empty, `platform.internalTest.manage` must be present.
 */
export function userHasInternalTestManage(
  user: Pick<IUser, "role" | "platformPermissionKeys"> | null | undefined
): boolean {
  if (!user || user.role !== "platform_admin") return false;
  const keys = user.platformPermissionKeys;
  if (!keys?.length) return true;
  return keys.includes(PLATFORM_INTERNAL_TEST_MANAGE);
}
