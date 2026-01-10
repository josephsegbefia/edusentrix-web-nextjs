// src/lib/demo/auth.ts
// Demo authentication utilities - provides user context for demo sessions

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_SESSION } from "./config";
import { verifyDemoSessionToken, isDemoSessionValid } from "./session";
import type { DemoSessionData } from "@/types/demo";
import type { CurrentAppUser } from "@/lib/auth/get-current-user";

export interface DemoUser extends CurrentAppUser {
  isDemo: true;
  demoTenantId: string;
  demoSessionData: DemoSessionData;
}

/**
 * Get the current demo session from cookies
 */
export async function getDemoSessionFromCookie(): Promise<DemoSessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEMO_SESSION.COOKIE_NAME)?.value;

  if (!token) return null;

  const session = await verifyDemoSessionToken(token);
  if (!session) return null;

  // Check if session is still valid
  if (!isDemoSessionValid(session)) return null;

  return session;
}

/**
 * Get demo user for server components - returns null if no valid demo session
 */
export async function getDemoUser(): Promise<DemoUser | null> {
  const session = await getDemoSessionFromCookie();
  if (!session) return null;

  // Construct a user object that matches CurrentAppUser interface
  const nameParts = session.fullName.split(" ");

  return {
    _id: `demo_${session.leadId}`,
    email: session.email,
    name: session.fullName,
    avatarUrl: undefined,
    role: "school_admin", // Demo users are always school admins
    schoolId: session.demoTenantId, // Use tenant ID as school reference
    pendingOnboarding: false,
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(),
    isDemo: true,
    demoTenantId: session.demoTenantId,
    demoSessionData: session,
  };
}

/**
 * Require demo user - redirects to demo signup if no valid session
 */
export async function requireDemoUser(): Promise<DemoUser> {
  const user = await getDemoUser();
  if (!user) {
    redirect("/demo?error=session_expired");
  }
  return user;
}

/**
 * Check if current request is from a demo session (for API routes)
 */
export async function isDemoRequest(): Promise<{ isDemo: boolean; demoTenantId?: string }> {
  const session = await getDemoSessionFromCookie();
  if (!session) return { isDemo: false };

  return {
    isDemo: true,
    demoTenantId: session.demoTenantId,
  };
}
