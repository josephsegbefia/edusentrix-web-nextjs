import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { DEMO_CONFIG } from "./runtime";
import { DemoSession, type IDemoSession } from "@/models/DemoSession";

/**
 * Generate a cryptographically random session token (hex, 64 chars).
 */
export function createDemoSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * SHA-256 hash of a raw token — this is what we store and look up by.
 */
export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Set the demo session cookie.  Call from a Route Handler where
 * `cookies()` is available for writing.
 */
export async function setDemoSessionCookie(rawToken: string): Promise<void> {
  const jar = await cookies();
  jar.set(DEMO_CONFIG.sessionCookieName, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEMO_CONFIG.defaultSessionMinutes * 60,
  });
}

/**
 * Clear the demo session cookie.
 */
export async function clearDemoSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(DEMO_CONFIG.sessionCookieName);
}

/**
 * Read the raw token from the incoming request cookie.
 * Works in Route Handlers and Server Components.
 */
export async function readDemoSessionCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(DEMO_CONFIG.sessionCookieName)?.value ?? null;
}

/**
 * Resolve a valid, active demo session from the incoming cookie.
 * Returns `null` when the cookie is missing, the token is unknown,
 * or the session is expired / inactive.
 *
 * Bumps `lastActiveAt` on every successful resolution so the session
 * reaper knows how recently the prospect interacted.
 */
export async function resolveDemoSessionFromCookie(): Promise<IDemoSession | null> {
  const raw = await readDemoSessionCookie();
  if (!raw) return null;

  const tokenHash = hashSessionToken(raw);
  const now = new Date();

  const session = await DemoSession.findOneAndUpdate(
    {
      sessionTokenHash: tokenHash,
      status: "active",
      expiresAt: { $gt: now },
    },
    { $set: { lastActiveAt: now } },
    { new: true }
  ).lean<IDemoSession>();

  return session ?? null;
}
