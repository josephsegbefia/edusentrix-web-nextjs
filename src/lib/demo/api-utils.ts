// src/lib/demo/api-utils.ts
// Utilities for API routes to handle demo sessions

import { cookies } from "next/headers";
import { DEMO_SESSION } from "./config";
import { verifyDemoSessionToken, isDemoSessionValid } from "./session";
import type { DemoSessionData } from "@/types/demo";

export interface DemoContext {
  isDemo: boolean;
  demoTenantId: string | null;
  session: DemoSessionData | null;
}

/**
 * Get demo context from cookies - for use in API routes
 */
export async function getDemoContext(): Promise<DemoContext> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(DEMO_SESSION.COOKIE_NAME)?.value;

    if (!token) {
      return { isDemo: false, demoTenantId: null, session: null };
    }

    const session = await verifyDemoSessionToken(token);
    if (!session || !isDemoSessionValid(session)) {
      return { isDemo: false, demoTenantId: null, session: null };
    }

    return {
      isDemo: true,
      demoTenantId: session.demoTenantId,
      session,
    };
  } catch {
    return { isDemo: false, demoTenantId: null, session: null };
  }
}

/**
 * Build a MongoDB filter that includes demo tenant filtering
 */
export function withDemoFilter<T extends Record<string, unknown>>(
  baseFilter: T,
  demoContext: DemoContext
): T & { demoTenantId?: string | null } {
  if (demoContext.isDemo && demoContext.demoTenantId) {
    return {
      ...baseFilter,
      demoTenantId: demoContext.demoTenantId,
    };
  }
  // For non-demo, explicitly exclude demo data
  return {
    ...baseFilter,
    demoTenantId: null,
  };
}

/**
 * Get the school ID for the current context
 * For demo: returns the demo school
 * For regular: returns the authenticated user's school
 */
export async function getSchoolIdForContext(
  demoContext: DemoContext,
  regularSchoolId: string | undefined
): Promise<string | null> {
  if (demoContext.isDemo && demoContext.demoTenantId) {
    // For demo, we need to find the school with this demoTenantId
    // This will be done by the calling code
    return demoContext.demoTenantId;
  }
  return regularSchoolId || null;
}
