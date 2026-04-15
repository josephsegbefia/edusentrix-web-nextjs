import { DemoLead, type IDemoLead } from "@/models/DemoLead";
import { DemoSession, type IDemoSession } from "@/models/DemoSession";
import { DemoSandbox } from "@/models/DemoSandbox";
import { DEMO_CONFIG } from "./runtime";
import {
  createDemoSessionToken,
  hashSessionToken,
  setDemoSessionCookie,
} from "./session";
import { allocateDemoSandbox } from "./sandbox";

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
  const normalizedEmail = input.email.toLowerCase().trim();

  const existingSession = await DemoSession.findOne({
    status: "active",
    expiresAt: { $gt: new Date() },
  })
    .populate<{ leadId: IDemoLead }>("leadId")
    .then((s) => {
      if (!s) return null;
      const lead = s.leadId as unknown as IDemoLead;
      if (lead?.email === normalizedEmail) return s;
      return null;
    });

  if (existingSession) {
    const lead = await DemoLead.findById(existingSession.leadId).lean<IDemoLead>();
    if (lead) {
      return { ok: true, lead, session: existingSession.toObject(), redirectTo: "/admin" };
    }
  }

  const lead = await DemoLead.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $setOnInsert: {
        fullName: input.fullName.trim(),
        email: normalizedEmail,
        phone: input.phone.trim(),
        schoolName: input.schoolName.trim(),
        schoolAddress: input.schoolAddress?.trim() || null,
        city: input.city?.trim() || null,
        region: input.region?.trim() || null,
        source: input.source || "demo_form",
        utm: input.utm || null,
        firstSeenAt: new Date(),
      },
      $set: { lastSeenAt: new Date() },
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
      expiresAt: new Date(),
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

  const rawToken = createDemoSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();
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
    activePersonaUserId: null,
    startedAt: now,
    expiresAt,
    lastActiveAt: now,
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
  });

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

  return {
    ok: true,
    lead,
    session: session.toObject(),
    redirectTo: "/admin",
  };
}
