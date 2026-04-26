// src/app/api/admin/admissions/delegate/route.ts
// School-level "current admissions delegate" management.
//
// GET    — current delegate (any admissions manager can read)
// POST   — assign a teacher (school admin only)
// DELETE — revoke (school admin only)
//
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §5.5.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { connectToDatabase } from "@/db/connectToDatabase";
import { UserMembership } from "@/models/UserMembership";
import { User } from "@/models/User";
import { Teacher } from "@/models/Teacher";
import { recordActivity } from "@/lib/audit/recordActivity";
import { AssignAdmissionsDelegateSchema } from "@/schemas/admissions";
import {
  ADMISSIONS_OFFICER_SUBROLE_KEY,
  grantAdmissionsOfficer,
  revokeAdmissionsOfficer,
} from "@/lib/admissions/access";

type DelegateDTO = {
  userId: string;
  teacherId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  photoUrl: string | null;
  assignedAt: string | null;
};

function toObjectId(value: unknown): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(String(value));
}

async function loadCurrentDelegate(
  schoolId: mongoose.Types.ObjectId
): Promise<DelegateDTO | null> {
  const membership = await UserMembership.findOne({
    schoolId,
    subroles: ADMISSIONS_OFFICER_SUBROLE_KEY,
    status: "active",
  })
    .sort({ updatedAt: -1 })
    .lean();
  if (!membership) return null;

  const userId = toObjectId(membership.userId);
  const [user, teacher] = await Promise.all([
    User.findById(userId)
      .select({ firstName: 1, lastName: 1, email: 1, photoUrl: 1 })
      .lean(),
    Teacher.findOne({ userId, schoolId })
      .select({ _id: 1 })
      .lean(),
  ]);

  if (!user) return null;

  return {
    userId: String(userId),
    teacherId: teacher ? String(teacher._id) : null,
    firstName: String(user.firstName ?? ""),
    lastName: String(user.lastName ?? ""),
    email: String(user.email ?? ""),
    photoUrl: (user.photoUrl as string | undefined) ?? null,
    assignedAt: membership.updatedAt
      ? new Date(membership.updatedAt).toISOString()
      : null,
  };
}

export async function GET() {
  try {
    const ctx = await requireAdmissionsManager();
    await connectToDatabase();
    const delegate = await loadCurrentDelegate(toObjectId(ctx.schoolId));
    return NextResponse.json({ success: true, data: delegate });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions delegate GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load admissions delegate" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();

    const body = await req.json();
    const parsed = AssignAdmissionsDelegateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const schoolId = toObjectId(ctx.schoolId);
    const adminUserId = toObjectId(ctx.userId);

    const teacher = await Teacher.findOne({
      _id: parsed.data.teacherId,
      schoolId,
    })
      .select({ _id: 1, userId: 1, status: 1 })
      .lean();
    if (!teacher) {
      return NextResponse.json(
        { success: false, error: "Teacher not found in this school" },
        { status: 404 }
      );
    }
    if (teacher.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: "This teacher is not currently active.",
        },
        { status: 409 }
      );
    }

    const teacherUserId = toObjectId(teacher.userId);
    const teacherMembership = await UserMembership.findOne({
      schoolId,
      userId: teacherUserId,
      status: "active",
    })
      .select({ roles: 1 })
      .lean();
    if (
      !teacherMembership ||
      !((teacherMembership.roles ?? []) as string[]).includes("teacher")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This user does not have an active teacher membership for this school.",
        },
        { status: 409 }
      );
    }

    // Only one active delegate at a time. Revoke any current holder first.
    const currentHolders = await UserMembership.find({
      schoolId,
      subroles: ADMISSIONS_OFFICER_SUBROLE_KEY,
      userId: { $ne: teacherUserId },
    })
      .select({ userId: 1 })
      .lean();
    for (const holder of currentHolders) {
      await revokeAdmissionsOfficer({
        schoolId,
        userId: toObjectId(holder.userId),
      });
    }

    await grantAdmissionsOfficer({ schoolId, userId: teacherUserId });

    await recordActivity({
      schoolId,
      userId: adminUserId,
      type: "admissions.delegate.assigned",
      entityType: "User",
      entityId: teacherUserId,
      description: "Assigned admissions delegate",
      metadata: {
        teacherId: String(teacher._id),
        userId: String(teacherUserId),
        revokedFrom: currentHolders.map((h) => String(h.userId)),
      },
    });

    const delegate = await loadCurrentDelegate(schoolId);
    return NextResponse.json({ success: true, data: delegate });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions delegate POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to assign admissions delegate" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolId = toObjectId(ctx.schoolId);
    const adminUserId = toObjectId(ctx.userId);

    const holders = await UserMembership.find({
      schoolId,
      subroles: ADMISSIONS_OFFICER_SUBROLE_KEY,
    })
      .select({ userId: 1 })
      .lean();

    if (holders.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    for (const holder of holders) {
      await revokeAdmissionsOfficer({
        schoolId,
        userId: toObjectId(holder.userId),
      });
    }

    await recordActivity({
      schoolId,
      userId: adminUserId,
      type: "admissions.delegate.revoked",
      entityType: "User",
      description: "Revoked admissions delegate",
      metadata: { revokedFrom: holders.map((h) => String(h.userId)) },
    });

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions delegate DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke admissions delegate" },
      { status: 500 }
    );
  }
}
