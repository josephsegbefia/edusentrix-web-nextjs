import type { NextRequest } from "next/server";

/**
 * Centralised demo-mode detection helpers.
 *
 * Both {@link isDemoHost} and {@link isDemoMode} return `false` when the
 * relevant env vars are unset, so production deploys are never affected.
 */

export const DEMO_CONFIG = {
  baseUrl: process.env.DEMO_BASE_URL ?? "",
  sessionSecret: process.env.DEMO_SESSION_SECRET ?? "",
  sessionCookieName: "edusentrix_demo_session",
  defaultSessionMinutes: Number(
    process.env.DEMO_DEFAULT_SESSION_MINUTES || 90
  ),
  maxActiveSessions: Number(process.env.DEMO_MAX_ACTIVE_SESSIONS || 20),
  uploadsEnabled: process.env.DEMO_UPLOADS_ENABLED === "true",
  aiEnabled: process.env.DEMO_AI_ENABLED !== "false",
  aiMaxRequestsPerSession: Number(
    process.env.DEMO_AI_MAX_REQUESTS_PER_SESSION || 20
  ),
} as const;

/**
 * Derive the expected demo hostname from `DEMO_BASE_URL`.
 * Handles both `https://demo.tryedusentrix.app` and bare `demo.tryedusentrix.app`.
 *
 * Reads the env var at call time so runtime changes (e.g. in tests) are
 * picked up without reloading the module.
 */
function demoHostname(): string {
  const raw = process.env.DEMO_BASE_URL ?? "";
  if (!raw) return "";
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Returns `true` when the incoming request is targeting the demo deployment.
 * Safe for production — returns `false` when `DEMO_BASE_URL` is not configured.
 */
export function isDemoHost(req: NextRequest | { headers: Headers }): boolean {
  const expected = demoHostname();
  if (!expected) return false;
  const host = req.headers.get("host") ?? req.headers.get("x-forwarded-host");
  if (!host) return false;
  const incoming = host.split(":")[0]?.toLowerCase().trim() ?? "";
  return incoming === expected;
}

/**
 * Returns `true` when the *current server process* is running in demo mode.
 * Useful for non-request contexts (jobs, scripts) where a request object is
 * unavailable.
 */
export function isDemoMode(): boolean {
  return process.env.APP_RUNTIME_MODE === "demo";
}

/**
 * The client-visible flag. Components can read this without importing
 * server-only modules.
 */
export function isClientDemoMode(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_APP_RUNTIME_MODE === "demo"
  );
}
