// src/app/api/admin/admissions/delegate/route.ts
// School-level admissions delegate — backed by `Delegation` (module `admissions`).
//
// GET    — current delegate (any admissions manager can read)
// POST   — assign a teacher (school admin only)
// DELETE — revoke (school admin only)

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { Teacher } from "@/models/Teacher";
import { Delegation } from "@/models/Delegation";
import { recordActivity } from "@/lib/audit/recordActivity";
import { AssignAdmissionsDelegateSchema } from "@/schemas/admissions";
import {
  revokeAdmissionsOfficer,
  ADMISSIONS_OFFICER_SUBROLE_KEY,
} from "@/lib/admissions/access";
import { UserMembership } from "@/models/UserMembership";
import { revokeOtherActiveDelegationsForModule } from "@/lib/delegations/service";
import { resolvePresetPermissions } from "@/lib/delegations/registry";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";

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
  const now = new Date();
  const delegation = await Delegation.findOne({
    schoolId,
    module: "admissions",
    status: "active",
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (!delegation) return null;

  const userId = toObjectId(delegation.staffUserId);
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
    assignedAt: delegation.updatedAt
      ? new Date(delegation.updatedAt).toISOString()
      : null,
  };
}

/** Clear legacy subroles for anyone still holding admissions_officer (migration hygiene). */
async function stripLegacyAdmissionsOfficers(schoolId: mongoose.Types.ObjectId) {
  const holders = await UserMembership.find({
    schoolId,
    subroles: ADMISSIONS_OFFICER_SUBROLE_KEY,
  })
    .select({ userId: 1 })
    .lean();
  for (const h of holders) {
    await revokeAdmissionsOfficer({ schoolId, userId: toObjectId(h.userId) });
  }
}

export async function GET() {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.view");
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

    await stripLegacyAdmissionsOfficers(schoolId);

    await revokeOtherActiveDelegationsForModule({
      schoolId,
      module: "admissions",
      keepStaffUserId: teacherUserId,
      revokedByUserId: adminUserId,
      reason: "Replaced admissions delegate",
    });

    const permissions = resolvePresetPermissions("admissions", "decision_maker");
    if (!permissions) {
      return NextResponse.json(
        { success: false, error: "Invalid delegation preset" },
        { status: 500 }
      );
    }

    await Delegation.updateMany(
      {
        schoolId,
        staffUserId: teacherUserId,
        module: "admissions",
        status: "active",
      },
      {
        $set: {
          status: "revoked",
          revokedAt: new Date(),
          revokedByUserId: adminUserId,
          revokeReason: "Replaced",
        },
      }
    );

    await Delegation.create({
      schoolId,
      staffUserId: teacherUserId,
      staffTeacherId: teacher._id,
      module: "admissions",
      preset: "decision_maker",
      permissions,
      status: "active",
      startsAt: new Date(),
      grantedByUserId: adminUserId,
      grantNote: "Assigned via Admissions delegation UI",
    });

    await recordActivity({
      schoolId,
      userId: adminUserId,
      type: "delegation.created",
      entityType: "Delegation",
      entityId: teacherUserId,
      description: "Granted admissions delegation (decision_maker)",
      metadata: {
        module: "admissions",
        preset: "decision_maker",
        staffUserId: String(teacherUserId),
        teacherId: String(teacher._id),
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

    const now = new Date();
    const result = await Delegation.updateMany(
      {
        schoolId,
        module: "admissions",
        status: "active",
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      },
      {
        $set: {
          status: "revoked",
          revokedAt: now,
          revokedByUserId: adminUserId,
          revokeReason: "Revoked by admin",
        },
      }
    );

    await stripLegacyAdmissionsOfficers(schoolId);

    await recordActivity({
      schoolId,
      userId: adminUserId,
      type: "delegation.revoked",
      entityType: "School",
      description: "Revoked all admissions delegations",
      metadata: { modifiedCount: result.modifiedCount },
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
