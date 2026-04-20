import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { DEMO_CONFIG } from "./runtime";
import { connectToDatabase } from "@/db/connectToDatabase";
import { DemoSession, type IDemoSession } from "@/models/DemoSession";
import { DemoLead } from "@/models/DemoLead";
import { School } from "@/models/School";
import { releaseDemoSandbox } from "./sandbox";
import { trackDemoEvent, DEMO_EVENT_CODES } from "./telemetry";

type EndDemoSessionReason =
  | "manual_end"
  | "idle_timeout"
  | "tab_closed"
  | "session_expired"
  | "invalid_sandbox";

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

function interactionCutoff(now: Date) {
  return new Date(now.getTime() - DEMO_CONFIG.idleTimeoutMinutes * 60_000);
}

async function finalizeDemoSession(
  session: Pick<
    IDemoSession,
    "_id" | "leadId" | "sandboxId" | "sandboxSchoolId" | "activePersonaRole"
  >,
  status: "ended" | "expired" | "abandoned",
  reason: EndDemoSessionReason,
  endedAt = new Date()
): Promise<void> {
  await DemoSession.updateOne(
    { _id: session._id },
    { $set: { status, endedAt } }
  );

  if (session.sandboxId) {
    await releaseDemoSandbox(session.sandboxId);
  }

  await DemoLead.updateOne(
    { _id: session.leadId },
    { $set: { status: "completed_demo", lastSeenAt: endedAt } }
  );

  await trackDemoEvent({
    leadId: session.leadId,
    sessionId: session._id,
    sandboxId: session.sandboxId,
    schoolId: session.sandboxSchoolId,
    actorRole: session.activePersonaRole,
    eventType: "session",
    eventCode:
      status === "abandoned"
        ? DEMO_EVENT_CODES.SESSION_EXPIRED
        : DEMO_EVENT_CODES.SESSION_ENDED,
    metadata: { reason, status },
  });
}

export async function endDemoSession(
  session: Pick<
    IDemoSession,
    "_id" | "leadId" | "sandboxId" | "sandboxSchoolId" | "activePersonaRole"
  >,
  reason: EndDemoSessionReason,
  endedAt = new Date()
): Promise<void> {
  const status =
    reason === "manual_end" || reason === "tab_closed" ? "ended" : "abandoned";
  await finalizeDemoSession(session, status, reason, endedAt);
}

export async function touchDemoSessionInteraction(
  sessionId: IDemoSession["_id"]
): Promise<void> {
  const now = new Date();
  await DemoSession.updateOne(
    { _id: sessionId, status: "active" },
    { $set: { lastActiveAt: now, lastInteractionAt: now } }
  );
}

/**
 * Resolve a valid, active demo session from the incoming cookie.
 * Returns `null` when the cookie is missing, the token is unknown,
 * or the session is expired / inactive.
 *
 * By default this only refreshes `lastActiveAt`; user-driven interaction
 * is tracked separately through `lastInteractionAt`.
 */
export async function resolveDemoSessionFromCookie(options?: {
  touch?: boolean;
  enforceIdleTimeout?: boolean;
}): Promise<IDemoSession | null> {
  const raw = await readDemoSessionCookie();
  if (!raw) return null;

  // Demo session resolution runs from server components, route handlers,
  // and guard helpers, so it must establish Mongo connectivity itself.
  await connectToDatabase();

  const tokenHash = hashSessionToken(raw);
  const now = new Date();
  const touch = options?.touch ?? true;
  const enforceIdleTimeout = options?.enforceIdleTimeout ?? true;

  const session = await DemoSession.findOne({
    sessionTokenHash: tokenHash,
    status: "active",
    expiresAt: { $gt: now },
  }).lean<IDemoSession>();

  if (!session) return null;

  if (!session.sandboxId || !session.sandboxSchoolId) {
    await finalizeDemoSession(session, "abandoned", "invalid_sandbox", now);
    return null;
  }

  const sandboxSchoolExists = await School.exists({ _id: session.sandboxSchoolId });
  if (!sandboxSchoolExists) {
    await finalizeDemoSession(session, "abandoned", "invalid_sandbox", now);
    return null;
  }

  const effectiveInteractionAt =
    session.lastInteractionAt ?? session.lastActiveAt ?? session.startedAt;
  if (
    enforceIdleTimeout &&
    effectiveInteractionAt &&
    new Date(effectiveInteractionAt).getTime() <= interactionCutoff(now).getTime()
  ) {
    await finalizeDemoSession(session, "abandoned", "idle_timeout", now);
    return null;
  }

  if (touch) {
    await DemoSession.updateOne(
      { _id: session._id, status: "active" },
      { $set: { lastActiveAt: now } }
    );
    return {
      ...session,
      lastActiveAt: now,
    };
  }

  return session;
}
