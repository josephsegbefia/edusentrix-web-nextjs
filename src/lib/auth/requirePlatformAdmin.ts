import "server-only";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";

export async function requirePlatformAdmin() {
  const gate = await requirePlatformPermission("platform.schools.read");
  if (!gate.ok) return gate;
  return { ok: true as const, me: gate.actor, actor: gate.actor };
}
