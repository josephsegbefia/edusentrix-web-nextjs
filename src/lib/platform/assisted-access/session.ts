import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import mongoose, { type Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PlatformAssistedAccessSession } from "@/models/PlatformAssistedAccessSession";
import { School } from "@/models/School";
import { User } from "@/models/User";

export const ASSISTED_ACCESS_COOKIE = "edusentrix_assisted_access";

export type ActiveAssistedAccessSession = {
  sessionId: string;
  schoolId: Types.ObjectId;
  schoolName: string;
  actorUserId: Types.ObjectId;
  actorEmail: string;
  actorName: string | null;
  reason: string;
  expiresAt: Date;
  startedAt: Date;
};

export function assistedAccessCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export function setAssistedAccessCookie(
  response: NextResponse,
  sessionId: string,
  expiresAt: Date
) {
  response.cookies.set(
    ASSISTED_ACCESS_COOKIE,
    sessionId,
    assistedAccessCookieOptions(expiresAt)
  );
}

export function clearAssistedAccessCookie(response: NextResponse) {
  response.cookies.set(ASSISTED_ACCESS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getActiveAssistedAccessSession(): Promise<ActiveAssistedAccessSession | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ASSISTED_ACCESS_COOKIE)?.value;
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) return null;

  await connectToDatabase();

  const actor = await User.findOne({ clerkUserId })
    .select("_id email firstName lastName name")
    .lean<{
      _id: Types.ObjectId;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      name?: string | null;
    } | null>();
  if (!actor) return null;

  const session = await PlatformAssistedAccessSession.findById(sessionId)
    .lean<{
      _id: Types.ObjectId;
      schoolId: Types.ObjectId;
      actorUserId: Types.ObjectId;
      actorEmail?: string | null;
      actorName?: string | null;
      reason: string;
      status: string;
      startedAt: Date;
      expiresAt: Date;
    } | null>();

  if (!session || session.status !== "active") return null;
  if (String(session.actorUserId) !== String(actor._id)) return null;

  const now = new Date();
  if (session.expiresAt <= now) {
    await PlatformAssistedAccessSession.updateOne(
      { _id: session._id, status: "active" },
      {
        $set: {
          status: "expired",
          endedAt: now,
          endReason: "session_expired",
        },
      }
    );
    return null;
  }

  const school = await School.findById(session.schoolId)
    .select("name status")
    .lean<{ _id: Types.ObjectId; name?: string | null; status?: string | null } | null>();
  if (!school) return null;

  return {
    sessionId: String(session._id),
    schoolId: session.schoolId,
    schoolName: school.name || "Unnamed School",
    actorUserId: session.actorUserId,
    actorEmail: session.actorEmail || actor.email || "",
    actorName:
      session.actorName ||
      actor.name ||
      [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
      null,
    reason: session.reason,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
  };
}
