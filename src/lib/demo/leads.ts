import { DemoLead, type IDemoLead } from "@/models/DemoLead";
import { DemoSession, type IDemoSession } from "@/models/DemoSession";
import { DemoSandbox } from "@/models/DemoSandbox";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { DEMO_CONFIG } from "./runtime";
import {
  createDemoSessionToken,
  endDemoSession,
  hashSessionToken,
  setDemoSessionCookie,
} from "./session";
import { allocateDemoSandbox } from "./sandbox";
import { trackDemoEvent, DEMO_EVENT_CODES } from "./telemetry";

export type DemoAccessInput = {
  fullName: string;
  email: string;
  phone: string;
  schoolName: string;
  schoolAddress?: string;
  city?: string;
  region?: string;
  source?: string;
  utm?: Record<string, string>;
  ipAddress?: string;
  userAgent?: string;
};

export type DemoAccessResult =
  | {
      ok: true;
      lead: IDemoLead;
      session: IDemoSession;
      redirectTo: string;
    }
  | {
      ok: false;
      reason: "capacity_blocked" | "error";
      message: string;
    };

/**
 * Idempotent lead + session creation.
 *
 * - If an active session for the same email already exists, reuse it.
 * - Otherwise create/update the lead, allocate a sandbox, create a
 *   session, and set the session cookie.
 */
export async function createOrReuseDemoAccess(
  input: DemoAccessInput
): Promise<DemoAccessResult> {
  const now = new Date();
  const normalizedEmail = input.email.toLowerCase().trim();

  const existingSession = await DemoSession.findOne({
    status: "active",
    expiresAt: { $gt: now },
  })
    .populate<{ leadId: IDemoLead }>("leadId")
    .then((s) => {
      if (!s) return null;
      const lead = s.leadId as unknown as IDemoLead;
      if (lead?.email === normalizedEmail) return s;
      return null;
    });

  if (existingSession) {
    const sandboxSchoolExists = existingSession.sandboxSchoolId
      ? await School.exists({ _id: existingSession.sandboxSchoolId })
      : false;

    if (
      !existingSession.sandboxId ||
      !existingSession.sandboxSchoolId ||
      !sandboxSchoolExists
    ) {
      await endDemoSession(existingSession, "invalid_sandbox", now);
    } else {
      const lead = await DemoLead.findById(existingSession.leadId).lean<IDemoLead>();
      if (lead) {
        const rawToken = createDemoSessionToken();
        await DemoSession.updateOne(
          { _id: existingSession._id },
          {
            $set: {
              sessionTokenHash: hashSessionToken(rawToken),
              lastActiveAt: now,
              lastInteractionAt: now,
            },
          }
        );
        await setDemoSessionCookie(rawToken);
        await DemoLead.updateOne(
          { _id: lead._id },
          { $set: { status: "active_demo", lastSeenAt: now, lastSessionId: existingSession._id } }
        );
        return {
          ok: true,
          lead,
          session: {
            ...existingSession.toObject(),
            lastActiveAt: now,
            lastInteractionAt: now,
          },
          redirectTo: "/admin",
        };
      }
    }
  }

  const lead = await DemoLead.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $setOnInsert: {
        email: normalizedEmail,
        source: input.source || "demo_form",
        utm: input.utm || null,
        firstSeenAt: now,
      },
      $set: {
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        schoolName: input.schoolName.trim(),
        schoolAddress: input.schoolAddress?.trim() || null,
        city: input.city?.trim() || null,
        region: input.region?.trim() || null,
        lastSeenAt: now,
      },
    },
    { upsert: true, new: true }
  ).lean<IDemoLead>();

  if (!lead) {
    return { ok: false, reason: "error", message: "Could not create demo lead." };
  }

  const sandbox = await allocateDemoSandbox(lead._id);
  if (!sandbox) {
    await DemoSession.create({
      leadId: lead._id,
      sandboxId: null,
      sandboxSchoolId: null,
      sessionTokenHash: hashSessionToken(createDemoSessionToken()),
      status: "capacity_blocked",
      expiresAt: now,
      lastActiveAt: now,
      lastInteractionAt: now,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
    });

    return {
      ok: false,
      reason: "capacity_blocked",
      message:
        "All demo slots are in use right now. Please try again in a few minutes or leave your details for a follow-up.",
    };
  }

  const schoolAdminUser = await User.findOne({
    schoolId: sandbox.schoolId,
    role: "school_admin",
  })
    .select("_id")
    .lean<{ _id: IDemoSession["activePersonaUserId"] } | null>();

  const rawToken = createDemoSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(
    now.getTime() + DEMO_CONFIG.defaultSessionMinutes * 60_000
  );

  const session = await DemoSession.create({
    leadId: lead._id,
    sandboxId: sandbox._id,
    sandboxSchoolId: sandbox.schoolId,
    sessionTokenHash: tokenHash,
    status: "active",
    activePersonaRole: "school_admin",
    activePersonaUserId: schoolAdminUser?._id ?? null,
    startedAt: now,
    expiresAt,
    lastActiveAt: now,
    lastInteractionAt: now,
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
  });

  await DemoSandbox.updateOne(
    { _id: sandbox._id },
    { $set: { allocatedSessionId: session._id } }
  );

  await DemoLead.updateOne(
    { _id: lead._id },
    {
      $set: {
        status: "active_demo",
        lastSessionId: session._id,
        ...(!lead.firstSessionId ? { firstSessionId: session._id } : {}),
      },
    }
  );

  await setDemoSessionCookie(rawToken);

  await trackDemoEvent({
    leadId: lead._id,
    sessionId: session._id,
    sandboxId: sandbox._id,
    schoolId: sandbox.schoolId,
    actorRole: "school_admin",
    actorUserId: schoolAdminUser?._id ?? null,
    eventType: "lead",
    eventCode: DEMO_EVENT_CODES.LEAD_CAPTURED,
    metadata: {
      source: input.source || "demo_form",
      schoolName: input.schoolName.trim(),
    },
  });
  await trackDemoEvent({
    leadId: lead._id,
    sessionId: session._id,
    sandboxId: sandbox._id,
    schoolId: sandbox.schoolId,
    actorRole: "school_admin",
    actorUserId: schoolAdminUser?._id ?? null,
    eventType: "session",
    eventCode: DEMO_EVENT_CODES.SESSION_STARTED,
    metadata: {
      email: normalizedEmail,
      schoolName: input.schoolName.trim(),
    },
  });
  await trackDemoEvent({
    leadId: lead._id,
    sessionId: session._id,
    sandboxId: sandbox._id,
    schoolId: sandbox.schoolId,
    actorRole: "school_admin",
    actorUserId: schoolAdminUser?._id ?? null,
    eventType: "sandbox",
    eventCode: DEMO_EVENT_CODES.SANDBOX_ALLOCATED,
    metadata: {
      sandboxId: String(sandbox._id),
      schoolId: String(sandbox.schoolId),
    },
  });

  return {
    ok: true,
    lead,
    session: session.toObject(),
    redirectTo: "/admin",
  };
}
