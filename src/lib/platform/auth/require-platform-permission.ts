import "server-only";
import { NextResponse } from "next/server";
import type { PlatformPermissionKey } from "@/lib/platform/permissions/registry";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import {
  hasAnyPlatformPermission,
  hasPlatformPermission,
} from "@/lib/platform/auth/has-platform-permission";

export async function requirePlatformPermission(permission: PlatformPermissionKey) {
  const auth = await requirePlatformUser();
  if (!auth.ok) return auth;

  if (!hasPlatformPermission(auth.actor, permission)) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, actor: auth.actor };
}

export async function requireAnyPlatformPermission(permissions: PlatformPermissionKey[]) {
  const auth = await requirePlatformUser();
  if (!auth.ok) return auth;

  if (!hasAnyPlatformPermission(auth.actor, permissions)) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, actor: auth.actor };
}
