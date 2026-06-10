import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  clearActiveSchoolCookie,
  resolveActiveSchoolContext,
  setActiveSchoolCookie,
} from "@/lib/auth/active-school-context";

export async function GET() {
  const result = await resolveActiveSchoolContext();
  if (!result.ok) {
    return NextResponse.json({
      success: true,
      data: {
        activeSchool: null,
        needsSchoolSelection: result.reason === "needs_school_selection",
        reason: result.reason,
        memberships: result.memberships || [],
      },
    });
  }

  const { context } = result;
  return NextResponse.json({
    success: true,
    data: {
      activeSchool: {
        schoolId: String(context.schoolId),
        schoolName: context.schoolName,
        roles: context.roles,
        homePath: context.homePath,
      },
      needsSchoolSelection: false,
      memberships: context.memberships,
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const schoolId = typeof body?.schoolId === "string" ? body.schoolId : "";

  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return NextResponse.json(
      { success: false, error: "A valid schoolId is required." },
      { status: 400 }
    );
  }

  const before = await resolveActiveSchoolContext();
  const memberships = before.ok ? before.context.memberships : before.memberships || [];
  const match = memberships.find((membership) => membership.schoolId === schoolId);

  if (!match || match.status !== "active") {
    return NextResponse.json(
      { success: false, error: "You do not have active access to this school." },
      { status: 403 }
    );
  }

  await setActiveSchoolCookie(schoolId);

  return NextResponse.json({
    success: true,
    data: {
      activeSchool: match,
      redirect: match.homePath,
    },
  });
}

export async function DELETE() {
  await clearActiveSchoolCookie();
  return NextResponse.json({ success: true });
}
