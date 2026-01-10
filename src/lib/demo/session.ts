// src/lib/demo/session.ts
// Demo session management - cookie handling and validation

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { DEMO_SESSION } from "./config";
import type { DemoSessionData } from "@/types/demo";

const JWT_SECRET = new TextEncoder().encode(
  process.env.DEMO_JWT_SECRET || process.env.NEXTAUTH_SECRET || "demo-secret-change-me"
);

/**
 * Create a demo session token (JWT)
 */
export async function createDemoSessionToken(
  data: Omit<DemoSessionData, "createdAt" | "expiresAt" | "hardExpiresAt">
): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEMO_SESSION.INACTIVITY_TIMEOUT_MS);
  const hardExpiresAt = new Date(now.getTime() + DEMO_SESSION.HARD_TIMEOUT_MS);

  const sessionData: DemoSessionData = {
    ...data,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    hardExpiresAt: hardExpiresAt.toISOString(),
  };

  const token = await new SignJWT(sessionData as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(hardExpiresAt)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode a demo session token
 */
export async function verifyDemoSessionToken(
  token: string
): Promise<DemoSessionData | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as DemoSessionData;
  } catch {
    return null;
  }
}

/**
 * Set the demo session cookie
 */
export async function setDemoSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION.COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DEMO_SESSION.COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Get the demo session from cookie
 */
export async function getDemoSession(): Promise<DemoSessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEMO_SESSION.COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyDemoSessionToken(token);
}

/**
 * Clear the demo session cookie
 */
export async function clearDemoSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION.COOKIE_NAME);
}

/**
 * Check if a demo session is still valid (not expired)
 */
export function isDemoSessionValid(session: DemoSessionData): boolean {
  const now = new Date();
  const hardExpiry = new Date(session.hardExpiresAt);
  return now < hardExpiry;
}

/**
 * Check if session needs activity refresh (approaching inactivity timeout)
 */
export function sessionNeedsRefresh(session: DemoSessionData): boolean {
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  // Refresh if less than 5 minutes left on inactivity timeout
  const refreshThreshold = 5 * 60 * 1000;
  return expiresAt.getTime() - now.getTime() < refreshThreshold;
}

/**
 * Create a refreshed session token (extends inactivity timeout)
 */
export async function refreshDemoSession(
  session: DemoSessionData
): Promise<string | null> {
  // Don't refresh if past hard expiry
  if (!isDemoSessionValid(session)) return null;

  const now = new Date();
  const hardExpiry = new Date(session.hardExpiresAt);

  // Calculate new inactivity expiry (capped at hard expiry)
  const newInactivityExpiry = new Date(
    Math.min(
      now.getTime() + DEMO_SESSION.INACTIVITY_TIMEOUT_MS,
      hardExpiry.getTime()
    )
  );

  const refreshedSession: DemoSessionData = {
    ...session,
    expiresAt: newInactivityExpiry.toISOString(),
  };

  const token = await new SignJWT(refreshedSession as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(hardExpiry)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Get remaining session time in seconds
 */
export function getRemainingSessionTime(session: DemoSessionData): {
  inactivitySeconds: number;
  hardLimitSeconds: number;
} {
  const now = Date.now();
  const inactivityExpiry = new Date(session.expiresAt).getTime();
  const hardExpiry = new Date(session.hardExpiresAt).getTime();

  return {
    inactivitySeconds: Math.max(0, Math.floor((inactivityExpiry - now) / 1000)),
    hardLimitSeconds: Math.max(0, Math.floor((hardExpiry - now) / 1000)),
  };
}
