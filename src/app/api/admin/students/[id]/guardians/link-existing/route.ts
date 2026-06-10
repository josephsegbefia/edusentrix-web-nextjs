import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { recordActivity } from "@/lib/audit/recordActivity";
import { delegationAuditFields } from "@/lib/audit/delegationAuditFields";
import { buildSchoolUserAuditContext, resolveAuditIdempotencyKey } from "@/lib/audit/fromApiRoute";
import { writeRetryableAuditEvent } from "@/lib/audit/writeRetryableAuditEvent";
import { ensureMembershipForUser } from "@/lib/auth/canonical-user";
import {
  formatGuardianDto,
  getGuardianSiblingCandidates,
} from "@/lib/guardians/guardian-linking";
import { Guardian } from "@/models/Guardian";
import { Student } from "@/models/Student";
import { User } from "@/models/User";

const LinkExistingGuardianSchema = z.object({
  userId: z.string().length(24),
  relationship: z.enum([
    "mother",
    "father",
    "guardian",
    "step_mother",
    "step_father",
    "grandmother",
    "grandfather",
    "aunt",
    "uncle",
    "other",
  ]),
  isPrimary: z.boolean().default(false),
  occupation: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

function toObjectIdOrNull(value: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authCtx = await requireSchoolAdminOrDelegatedAnyPermission([
      "students.edit",
    ]);
    await connectToDatabase();

    const { id } = await ctx.params;
    const studentId = toObjectIdOrNull(id);
    const schoolIdObj = toObjectIdOrNull(String(authCtx.schoolId));
    const actorId = toObjectIdOrNull(String(authCtx.userId));
    if (!studentId || !schoolIdObj || !actorId) {
      return NextResponse.json(
        { success: false, error: "Invalid student, school, or user context" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validated = LinkExistingGuardianSchema.parse(body);
    const parentUserId = new mongoose.Types.ObjectId(validated.userId);

    const [student, parentUser] = await Promise.all([
      Student.findOne({ _id: studentId, schoolId: schoolIdObj })
        .select("_id firstName lastName")
        .lean<{ _id: mongoose.Types.ObjectId; firstName: string; lastName: string } | null>(),
      User.findById(parentUserId)
        .select("_id email phone avatarUrl clerkUserId firstName lastName name")
        .lean<{
          _id: mongoose.Types.ObjectId;
          email: string;
          phone?: string | null;
          avatarUrl?: string | null;
          clerkUserId?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          name?: string | null;
        } | null>(),
    ]);

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }
    if (!parentUser?.email) {
      return NextResponse.json(
        { success: false, error: "Parent user not found" },
        { status: 404 }
      );
    }

    const existingGuardian = await Guardian.findOne({
      studentId,
      userId: parentUserId,
    })
      .select("_id")
      .lean();

    if (existingGuardian) {
      return NextResponse.json(
        {
          success: false,
          error: "This parent is already linked to this student",
        },
        { status: 409 }
      );
    }

    if (validated.isPrimary) {
      await Guardian.updateMany(
        { studentId, isPrimary: true },
        { $set: { isPrimary: false } }
      );
    }

    await ensureMembershipForUser({
      userId: parentUserId,
      schoolId: schoolIdObj,
      role: "parent",
      status: "active",
    });

    const guardian = await Guardian.create({
      studentId,
      userId: parentUserId,
      relationship: validated.relationship,
      occupation: validated.occupation?.trim() || null,
      isPrimary: validated.isPrimary,
      phone: validated.phone?.trim() || parentUser.phone || null,
      email: parentUser.email.toLowerCase().trim(),
      photoUrl: parentUser.avatarUrl || null,
    });

    try {
      await writeRetryableAuditEvent({
        actionCode: "guardian.linked_existing",
        scopeType: "school",
        scopeId: String(schoolIdObj),
        result: "succeeded",
        target: {
          targetEntityType: "Guardian",
          targetEntityId: guardian._id,
          secondaryEntityType: "Student",
          secondaryEntityId: studentId,
        },
        context: buildSchoolUserAuditContext(req, {
          userId: actorId,
          schoolId: schoolIdObj,
          actorRole: "school_admin",
          idempotencyKey: resolveAuditIdempotencyKey(
            req,
            `guardian.linked_existing:${String(guardian._id)}`
          ),
        }),
        payload: {
          metadata: {
            relationship: validated.relationship,
            isPrimary: validated.isPrimary,
            parentUserId: String(parentUserId),
          },
        },
        streamKey: `school:${String(schoolIdObj)}:identity`,
      });
    } catch (auditErr) {
      console.error("guardian.linked_existing audit failed:", auditErr);
    }

    await recordActivity({
      schoolId: schoolIdObj,
      userId: actorId,
      type: "guardian.created",
      entityType: "student",
      entityId: String(studentId),
      description: `Linked existing parent to ${student.firstName} ${student.lastName}`,
      ...delegationAuditFields({
        isDelegatedActor: !authCtx.isSchoolAdmin,
        activeDelegationId: authCtx.activeDelegationId,
        module: "students",
        action: "guardian.linked_existing",
      }),
      metadata: {
        guardianId: String(guardian._id),
        studentId: String(studentId),
        parentUserId: String(parentUserId),
        relationship: validated.relationship,
        isPrimary: validated.isPrimary,
      },
    });

    const createdGuardian = await Guardian.findById(guardian._id)
      .populate("userId", "name firstName lastName email avatarUrl clerkUserId")
      .lean();

    if (!createdGuardian) {
      return NextResponse.json(
        { success: false, error: "Guardian not found after link" },
        { status: 404 }
      );
    }

    const siblingCandidates = await getGuardianSiblingCandidates({
      schoolId: schoolIdObj,
      studentId,
      userId: parentUserId,
    });

    return NextResponse.json({
      success: true,
      data: {
        guardian: formatGuardianDto(
          createdGuardian as Parameters<typeof formatGuardianDto>[0]
        ),
        siblingCandidates,
      },
    });
  } catch (error) {
    console.error("Existing guardian link failed:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to link existing guardian",
      },
      { status: 500 }
    );
  }
}
