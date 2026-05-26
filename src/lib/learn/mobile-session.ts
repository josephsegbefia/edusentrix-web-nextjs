import { createHash, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LearnStudentSession } from "@/models/LearnStudentSession";

export const LEARN_MOBILE_SESSION_DAYS = 30;
export const LEARN_MOBILE_TEMP_SESSION_MINUTES = 20;

export function createLearnMobileAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLearnMobileAccessToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function learnMobileSessionExpiresAt(days = LEARN_MOBILE_SESSION_DAYS): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function learnMobileTempSessionExpiresAt(
  minutes = LEARN_MOBILE_TEMP_SESSION_MINUTES
): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function createLearnMobileSession(input: {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId: Types.ObjectId;
  expiresAt: Date;
  deviceName?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}) {
  await connectToDatabase();

  const accessToken = createLearnMobileAccessToken();
  const tokenHash = hashLearnMobileAccessToken(accessToken);
  const now = new Date();

  const session = await LearnStudentSession.create({
    schoolId: input.schoolId,
    studentId: input.studentId,
    accountId: input.accountId,
    tokenHash,
    expiresAt: input.expiresAt,
    startedAt: now,
    endedAt: null,
    lastSeenAt: now,
    deviceId: input.deviceName?.trim() || null,
    userAgent: input.userAgent?.trim() || null,
    ipAddress: input.ipAddress?.trim() || null,
  });

  return { accessToken, session, expiresAt: input.expiresAt };
}

export async function revokeLearnMobileSession(sessionId: Types.ObjectId) {
  await connectToDatabase();
  await LearnStudentSession.updateOne(
    { _id: sessionId, endedAt: null },
    { $set: { endedAt: new Date() } }
  );
}

export async function findActiveLearnMobileSession(rawToken: string) {
  await connectToDatabase();
  const tokenHash = hashLearnMobileAccessToken(rawToken);
  const now = new Date();

  const session = await LearnStudentSession.findOne({
    tokenHash,
    endedAt: null,
    expiresAt: { $gt: now },
  }).lean();

  if (!session) return null;

  await LearnStudentSession.updateOne(
    { _id: session._id },
    { $set: { lastSeenAt: now } }
  );

  return session;
}
