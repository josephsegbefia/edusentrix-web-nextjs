/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/students/[id]/guardians/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { User } from "@/models/User";
import { Invitation } from "@/models/Invitation";
import { School } from "@/models/School";
import { clerkClient } from "@clerk/nextjs/server";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email/templates";
import { recordActivity } from "@/lib/audit/recordActivity";
import { delegationAuditFields } from "@/lib/audit/delegationAuditFields";
import { writeRetryableAuditEvent } from "@/lib/audit/writeRetryableAuditEvent";
import {
  buildSchoolUserAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import mongoose from "mongoose";
import { z } from "zod";
import {
  getInvitationAcceptUrl,
  getInvitationRedirectUrl,
} from "@/lib/utils/getAppUrl";
import { ensureCanonicalUserForEmail, ensureMembershipForUser } from "@/lib/auth/canonical-user";
import {
  formatGuardianDto,
  getGuardianSiblingCandidates,
} from "@/lib/guardians/guardian-linking";

const CreateGuardianSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().nullable(),
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
  occupation: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  isPrimary: z.boolean().default(false),
});

const LinkExistingGuardianSchema = z.object({
  mode: z.literal("link_existing"),
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
  occupation: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
});

// GET - Fetch all guardians for a student
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("students");
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: "School ID not found" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Verify student belongs to admin's school
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    }).lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Fetch guardians
    const guardians = await Guardian.find({
      studentId: new mongoose.Types.ObjectId(id),
    })
      .populate("userId", "firstName lastName email avatarUrl clerkUserId")
      .sort({ isPrimary: -1, createdAt: 1 })
      .lean();

    const guardiansData = guardians.map((g: any) => {
      const user = g.userId as any;
      return {
        id: String(g._id),
        userId: String(user._id),
        fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        relationship: g.relationship,
        phone: g.phone || "",
        email: g.email || user.email || "",
        occupation: g.occupation || null,
        photoUrl: g.photoUrl || user.avatarUrl || null,
        isPrimary: g.isPrimary,
        createdAt: g.createdAt.toISOString(),
        hasPlatformAccount: Boolean(user.clerkUserId),
      };
    });

    return NextResponse.json({
      success: true,
      data: guardiansData,
    });
  } catch (error) {
    console.error("Failed to fetch guardians:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch guardians",
      },
      { status: 500 }
    );
  }
}

// POST - Create a new guardian
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authCtx = await requireSchoolAdminOrDelegatedAnyPermission([
      "students.edit",
    ]);
    const { schoolId, userId } = authCtx;
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: "School ID not found" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const body = await req.json();
    if (body?.mode === "link_existing") {
      const validated = LinkExistingGuardianSchema.parse(body);
      const studentIdObj = new mongoose.Types.ObjectId(id);
      const parentUserId = new mongoose.Types.ObjectId(validated.userId);

      const [student, parentUser] = await Promise.all([
        Student.findOne({
          _id: studentIdObj,
          schoolId: schoolIdObj,
        })
          .select("_id firstName lastName")
          .lean(),
        User.findById(parentUserId)
          .select("_id email phone avatarUrl clerkUserId firstName lastName name")
          .lean(),
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
        studentId: studentIdObj,
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
          { studentId: studentIdObj, isPrimary: true },
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
        studentId: studentIdObj,
        userId: parentUserId,
        relationship: validated.relationship,
        occupation: validated.occupation?.trim() || null,
        isPrimary: validated.isPrimary,
        phone: validated.phone?.trim() || (parentUser as any).phone || null,
        email: String((parentUser as any).email).toLowerCase().trim(),
        photoUrl: (parentUser as any).avatarUrl || null,
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
            secondaryEntityId: studentIdObj,
          },
          context: buildSchoolUserAuditContext(req, {
            userId: new mongoose.Types.ObjectId(String(userId)),
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
        userId: new mongoose.Types.ObjectId(userId),
        type: "guardian.created",
        entityType: "student",
        entityId: String(studentIdObj),
        description: `Linked existing parent to ${(student as any).firstName} ${(student as any).lastName}`,
        ...delegationAuditFields({
          isDelegatedActor: !authCtx.isSchoolAdmin,
          activeDelegationId: authCtx.activeDelegationId,
          module: "students",
          action: "guardian.linked_existing",
        }),
        metadata: {
          guardianId: String(guardian._id),
          studentId: String(studentIdObj),
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
        studentId: studentIdObj,
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
    }

    const validated = CreateGuardianSchema.parse(body);

    // Verify student belongs to admin's school
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    }).lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const studentIdObj = new mongoose.Types.ObjectId(id);

    const lookupEmail = validated.email.toLowerCase().trim();

    const emailLower = lookupEmail;

    let userIdObj: mongoose.Types.ObjectId;
    const studentName = `${(student as any).firstName || ""} ${(student as any).lastName || ""}`.trim();

    const inviteParentIfNeeded = async (parentMongoId: mongoose.Types.ObjectId) => {
      const existingPendingInvite = await Invitation.findOne({
        schoolId: schoolIdObj,
        email: emailLower,
        role: "parent",
        status: "pending",
        expiresAt: { $gt: new Date() },
      })
        .select("_id")
        .lean<{ _id: mongoose.Types.ObjectId } | null>();

      if (existingPendingInvite) {
        return;
      }

      const redirectUrl = getInvitationRedirectUrl();
      let clerkInvitationId: string | undefined;
      let invitationStatus: "pending" | "failed" = "pending";

      try {
        const clerk = await clerkClient();
        const clerkInvitation = await clerk.invitations.createInvitation({
          emailAddress: emailLower,
          redirectUrl,
          notify: false,
          publicMetadata: {
            role: "parent",
            schoolId: String(schoolIdObj),
          },
          ignoreExisting: true,
        });
        clerkInvitationId = clerkInvitation.id;

        const school = await School.findById(schoolIdObj).select("name").lean();
        const schoolName = school ? (school as any).name : "your school";

        const rendered = renderTemplate("USER_INVITE", {
          name: `${validated.firstName} ${validated.lastName}`,
          role: "parent",
          schoolName,
          setupLink: getInvitationAcceptUrl(clerkInvitation, redirectUrl),
        });

        await sendTrackedBrevoEmail({
          to: emailLower,
          subject: rendered.subject,
          htmlContent: rendered.htmlContent,
          textContent: rendered.textContent,
          templateKey: "PARENT_INVITE",
          schoolId: String(schoolIdObj),
          schoolName,
          actorId: String(userId),
          actorRole: "school_admin",
          relatedEntityType: "invitation",
        });
      } catch (clerkError) {
        console.error("Clerk invitation error:", clerkError);
        invitationStatus = "failed";
      }

      try {
        await Invitation.create({
          email: emailLower,
          role: "parent",
          schoolId: schoolIdObj,
          status: invitationStatus,
          clerkInvitationId,
          sentAt: new Date(),
          acceptedAt: undefined,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          invitedBy: new mongoose.Types.ObjectId(userId),
          metadata: {
            firstName: validated.firstName,
            lastName: validated.lastName,
            studentId: id,
            studentName,
            relationship: validated.relationship,
            invitationEmailSuppressed: false,
          },
        });
      } catch (inviteRecordError) {
        console.error("Failed to create parent invitation record:", inviteRecordError);
      }
    };

    const parentUser = await ensureCanonicalUserForEmail({
      email: emailLower,
      firstName: validated.firstName.trim(),
      lastName: validated.lastName.trim(),
      phone: validated.phone?.trim() || undefined,
      avatarUrl: validated.photoUrl || undefined,
      role: "parent",
      schoolId: schoolIdObj,
      pendingOnboarding: false,
    });

    userIdObj =
      parentUser._id instanceof mongoose.Types.ObjectId
        ? parentUser._id
        : new mongoose.Types.ObjectId(String(parentUser._id));

    await ensureMembershipForUser({
      userId: userIdObj,
      schoolId: schoolIdObj,
      role: "parent",
      status: "active",
    });

    if (!parentUser.clerkUserId) {
      await inviteParentIfNeeded(userIdObj);
    }

    // Handle primary guardian - unset others if this is primary
    if (validated.isPrimary) {
      await Guardian.updateMany(
        {
          studentId: studentIdObj,
          isPrimary: true,
        },
        { $set: { isPrimary: false } }
      );
    }

    // Check if guardian relationship already exists
    const existingGuardian = await Guardian.findOne({
      studentId: studentIdObj,
      userId: userIdObj,
    }).lean();

    if (existingGuardian) {
      return NextResponse.json(
        {
          success: false,
          error: "This parent is already linked to this student",
        },
        { status: 400 }
      );
    }

    // Create guardian relationship
    const guardian = new Guardian({
      studentId: studentIdObj,
      userId: userIdObj,
      relationship: validated.relationship,
      occupation: validated.occupation?.trim() || null,
      isPrimary: validated.isPrimary,
      phone: validated.phone?.trim() || null,
      email: emailLower,
      photoUrl: validated.photoUrl || null,
    });

    await guardian.save();

    try {
      await writeRetryableAuditEvent({
        actionCode: "guardian.linked",
        scopeType: "school",
        scopeId: String(schoolIdObj),
        result: "succeeded",
        target: {
          targetEntityType: "Guardian",
          targetEntityId: guardian._id,
          secondaryEntityType: "Student",
          secondaryEntityId: studentIdObj,
        },
        context: buildSchoolUserAuditContext(req, {
          userId: new mongoose.Types.ObjectId(String(userId)),
          schoolId: schoolIdObj,
          actorRole: "school_admin",
          idempotencyKey: resolveAuditIdempotencyKey(
            req,
            `guardian.linked:${String(guardian._id)}`
          ),
        }),
        payload: {
          metadata: {
            relationship: validated.relationship,
            isPrimary: validated.isPrimary,
          },
        },
        streamKey: `school:${String(schoolIdObj)}:identity`,
      });
    } catch (auditErr) {
      console.error("guardian.linked audit failed:", auditErr);
    }

    // Record activity
    await recordActivity({
      schoolId: schoolIdObj,
      userId: new mongoose.Types.ObjectId(userId),
      type: "guardian.created",
      entityType: "student",
      entityId: String(studentIdObj),
      description: `Added guardian: ${validated.firstName} ${validated.lastName} (${validated.relationship}) for student`,
      ...delegationAuditFields({
        isDelegatedActor: !authCtx.isSchoolAdmin,
        activeDelegationId: authCtx.activeDelegationId,
        module: "students",
        action: "guardian.created",
      }),
      metadata: {
        guardianId: String(guardian._id),
        studentId: String(studentIdObj),
        relationship: validated.relationship,
        isPrimary: validated.isPrimary,
      },
    });

    // Fetch created guardian with user data
    const createdGuardianRaw = await Guardian.findById(guardian._id)
      .populate("userId", "firstName lastName email avatarUrl clerkUserId")
      .lean();
    const createdGuardian = Array.isArray(createdGuardianRaw)
      ? createdGuardianRaw[0] || null
      : createdGuardianRaw;

    if (!createdGuardian) {
      return NextResponse.json(
        { success: false, error: "Guardian not found after create" },
        { status: 404 }
      );
    }

    const user = (createdGuardian as any).userId as any;

    return NextResponse.json({
      success: true,
      data: {
        id: String(createdGuardian._id),
        userId: String(user._id),
        fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        relationship: (createdGuardian as any).relationship,
        phone: (createdGuardian as any).phone || "",
        email: (createdGuardian as any).email || user.email || "",
        occupation: (createdGuardian as any).occupation || null,
        photoUrl:
          (createdGuardian as any).photoUrl || user.avatarUrl || null,
        isPrimary: (createdGuardian as any).isPrimary,
        createdAt: (createdGuardian as any).createdAt.toISOString(),
        hasPlatformAccount: Boolean(user.clerkUserId),
      },
    });
  } catch (error) {
    console.error("Failed to create guardian:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: error.issues,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create guardian",
      },
      { status: 500 }
    );
  }
}
