import { isDemoMode } from "./runtime";
import { resolveDemoSessionFromCookie } from "./session";
import { resolveDemoMembership } from "./persona";
import type { IDemoSession } from "@/models/DemoSession";
import type { IUser } from "@/models/User";
import type { IUserMembership } from "@/models/UserMembership";

export type DemoGuardResult =
  | {
      isDemo: true;
      session: IDemoSession;
      user: Pick<IUser, "_id" | "schoolId" | "role" | "email">;
      membership: IUserMembership;
    }
  | { isDemo: false };

/**
 * Shared preamble for all `require*` guard helpers.
 *
 * When the server is in demo mode and a valid demo session cookie exists,
 * this resolves the synthetic user and membership directly — bypassing
 * Clerk `auth()` entirely.
 *
 * Guard helpers should call this first.  If `isDemo` is `true`, they can
 * skip their normal Clerk-based flow and use the returned context instead.
 */
export async function tryResolveDemoGuard(): Promise<DemoGuardResult> {
  if (!isDemoMode()) return { isDemo: false };

  const session = await resolveDemoSessionFromCookie();
  if (!session) return { isDemo: false };

  const resolved = await resolveDemoMembership(session);
  if (!resolved) return { isDemo: false };

  return {
    isDemo: true,
    session,
    user: resolved.user,
    membership: resolved.membership,
  };
}
