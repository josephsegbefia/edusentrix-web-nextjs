// src/lib/auth/get-current-user.ts
// test after moving to organization github
import "server-only";
import { redirect } from "next/navigation";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import type { AppRole } from "@/lib/roles";
import { isDemoMode } from "@/lib/demo/runtime";
import { resolveDemoSessionFromCookie } from "@/lib/demo/session";
import { resolveDemoPersona } from "@/lib/demo/persona";
import {
  resolveTenantUserForClerkSession,
  schoolIdFromClerkMetadata,
} from "@/lib/auth/resolveTenantUserForClerkSession";
import { validateInternalTestImpersonationSession } from "@/lib/internal-test/validate-impersonation-session";

export type CurrentAppUser = {
  _id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role?: AppRole;
  schoolId?: string;
  pendingOnboarding?: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Present when a platform operator is viewing the app as a test user (Phase 4). */
  internalTestImpersonation?: {
    schoolId: string;
    targetDisplayName: string;
    targetRole?: AppRole;
  };
};

export async function getCurrentUser(
  clerkUserId?: string
): Promise<CurrentAppUser | null> {
  if (!clerkUserId && isDemoMode()) {
    const session = await resolveDemoSessionFromCookie();
    if (session) return resolveDemoPersona(session);
  }

  const ita = await validateInternalTestImpersonationSession();
  if (ita) {
    const doc = ita.target;
    const name =
      [doc.firstName, doc.lastName].filter(Boolean).join(" ") || undefined;
    return {
      _id: String(doc._id),
      email: doc.email,
      name,
      avatarUrl: doc.avatarUrl,
      role: doc.role as AppRole | undefined,
      schoolId: doc.schoolId ? String(doc.schoolId) : undefined,
      pendingOnboarding: !!doc.pendingOnboarding,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      internalTestImpersonation: {
        schoolId: doc.schoolId ? String(doc.schoolId) : "",
        targetDisplayName: name || doc.email,
        targetRole: doc.role as AppRole | undefined,
      },
    };
  }

  let resolvedClerkId: string | null = clerkUserId ?? null;
  let email: string | undefined;
  let schoolIdFromMeta: string | undefined;

  if (clerkUserId) {
    // Bearer/mobile may pass userId without cookie auth() context
    const clerk = await clerkClient();
    const c = await clerk.users.getUser(clerkUserId);
    email =
      c.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? undefined;
    schoolIdFromMeta = schoolIdFromClerkMetadata(c);
    resolvedClerkId = clerkUserId;
  } else {
    const cu = await currentUser();
    if (!cu) return null;
    resolvedClerkId = cu.id;
    email =
      cu.primaryEmailAddress?.emailAddress?.toLowerCase() ??
      cu.emailAddresses?.[0]?.emailAddress?.toLowerCase() ??
      undefined;
    schoolIdFromMeta = schoolIdFromClerkMetadata(cu);
  }

  if (!resolvedClerkId) return null;

  await connectToDatabase();

  const doc = await resolveTenantUserForClerkSession({
    clerkUserId: resolvedClerkId,
    email: email ?? "",
    schoolIdFromMetadata: schoolIdFromMeta,
  });

  if (!doc) return null;

  const name =
    [doc.firstName, doc.lastName].filter(Boolean).join(" ") || undefined;

  return {
    _id: String(doc._id),
    email: doc.email,
    name,
    avatarUrl: doc.avatarUrl,
    role: doc.role as AppRole | undefined,
    schoolId: doc.schoolId ? String(doc.schoolId) : undefined,
    pendingOnboarding: !!doc.pendingOnboarding,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function requireUser() {
  const me = await getCurrentUser();
  if (!me) {
    // Redirect to sign-in page if user is not authenticated
    redirect("/sign-in");
  }
  return me;
}
