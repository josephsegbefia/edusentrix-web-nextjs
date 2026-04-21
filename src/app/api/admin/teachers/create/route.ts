/* eslint-disable @typescript-eslint/no-explicit-any */
// POST /api/admin/teachers/create
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { Subject, type ISubject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import { UserMembership } from "@/models/UserMembership";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { School } from "@/models/School";
import { clerkClient } from "@clerk/nextjs/server";
import { Invitation } from "@/models/Invitation";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { recordActivity } from "@/lib/audit/recordActivity";
import mongoose from "mongoose";
import {
  getInvitationAcceptUrl,
  getInvitationRedirectUrl,
} from "@/lib/utils/getAppUrl";
import { enforceSchoolLimit } from "@/lib/auth/checkLimit";
import { trackUsage } from "@/lib/billing/trackUsage";
import {
  deactivateOtherTeachersOnSlot,
  findOtherTeachersOnSlot,
} from "@/lib/admin/teacher-assignment-slot";

type Body = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  subjectIds?: string[];
  /** Subject + class group pairs; creates TeacherAssignment for the current (or chosen) academic period */
  teachingAssignments?: Array<{ subjectId: string; classGroupId: string }>;
  academicPeriodId?: string;
  homeroomClassGroupId?: string;
  status?: "active" | "inactive";
  /** If another teacher already has an active assignment for the same subject/class/period */
  teachingAssignmentResolution?: "add_alongside" | "replace" | "skip";
};

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await enforceSchoolLimit({
      schoolId,
      limitKey: "maxTeachers",
      message: "The teacher limit for this subscription has been reached.",
    });
    await connectToDatabase();

    const body = (await req.json()) as Body;

    // Log received payload for debugging
    console.log("Teacher creation request payload:", {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      hasPhone: !!body.phone,
      hasPhotoUrl: !!body.photoUrl,
      subjectIdsCount: body.subjectIds?.length || 0,
      teachingAssignmentsCount: body.teachingAssignments?.length || 0,
      hasHomeroom: !!body.homeroomClassGroupId,
      status: body.status,
    });

    // Normalize optional fields - convert empty strings to undefined
    const rawAssignments = Array.isArray(body.teachingAssignments)
      ? body.teachingAssignments
      : [];
    const seenPairs = new Set<string>();
    const teachingAssignmentsDeduped: Array<{
      subjectId: string;
      classGroupId: string;
    }> = [];
    for (const row of rawAssignments) {
      const sid = String(row?.subjectId || "").trim();
      const cid = String(row?.classGroupId || "").trim();
      if (!sid || !cid) continue;
      const key = `${sid}|${cid}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      teachingAssignmentsDeduped.push({ subjectId: sid, classGroupId: cid });
    }

    const rawResolution = body.teachingAssignmentResolution;
    const teachingAssignmentResolution =
      rawResolution === "replace" || rawResolution === "skip"
        ? rawResolution
        : "add_alongside";

    const normalizedBody: Body = {
      ...body,
      phone: body.phone?.trim() || undefined,
      photoUrl: body.photoUrl?.trim() || undefined,
      homeroomClassGroupId:
        body.homeroomClassGroupId?.trim() || undefined,
      subjectIds:
        body.subjectIds && body.subjectIds.length > 0
          ? body.subjectIds
              .map((id) => id?.trim())
              .filter((id): id is string => !!id)
          : undefined,
      teachingAssignments: teachingAssignmentsDeduped,
      academicPeriodId: body.academicPeriodId?.trim() || undefined,
      status: body.status || "active",
    };

    if (teachingAssignmentsDeduped.length < 1) {
      return new Response(
        JSON.stringify({
          error:
            "Add at least one teaching assignment (subject and class group) before creating the teacher.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (
      !normalizedBody.firstName?.trim() ||
      !normalizedBody.lastName?.trim() ||
      !normalizedBody.email?.trim()
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          details: {
            firstName: !normalizedBody.firstName?.trim(),
            lastName: !normalizedBody.lastName?.trim(),
            email: !normalizedBody.email?.trim(),
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedBody.email.trim())) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    // Same email allowed in different schools; block duplicates within this school
    const existingUser = await User.findOne({
      email: normalizedBody.email.toLowerCase().trim(),
      schoolId: schoolIdObj,
    }).lean();

    if (existingUser) {
      return new Response(
        JSON.stringify({
          error:
            "A user with this email already exists in your school. Use a different email or update the existing staff record.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const subjectIdStringsFromAssignments = (
      normalizedBody.teachingAssignments || []
    )
      .map((t) => t.subjectId)
      .filter((id) => mongoose.isValidObjectId(id));
    const mergedSubjectIdStrings = Array.from(
      new Set([
        ...(normalizedBody.subjectIds || []),
        ...subjectIdStringsFromAssignments,
      ])
    );

    let subjectIds: mongoose.Types.ObjectId[] = [];
    if (mergedSubjectIdStrings.length > 0) {
      const validSubjectIds = mergedSubjectIdStrings.filter((id) =>
        mongoose.isValidObjectId(id)
      );

      if (mergedSubjectIdStrings.length > 0 && validSubjectIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "One or more subject IDs are invalid" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const subs = (await Subject.find({
        _id: { $in: validSubjectIds },
        schoolId,
        isActive: true,
      }).lean()) as unknown as ISubject[];

      subjectIds = subs.map((s: ISubject) => {
        const id = s._id;
        return id instanceof mongoose.Types.ObjectId
          ? id
          : new mongoose.Types.ObjectId(String(id));
      });

      if (subjectIds.length !== validSubjectIds.length) {
        return new Response(
          JSON.stringify({
            error: "One or more subject IDs are invalid or not found",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    let academicPeriodObjId: mongoose.Types.ObjectId | null = null;
    let classGroupById: Map<
      string,
      { _id: mongoose.Types.ObjectId; subjectIds?: unknown; name?: string }
    > | null = null;
    const assignmentRows = normalizedBody.teachingAssignments || [];
    if (assignmentRows.length > 0) {
      if (
        normalizedBody.academicPeriodId &&
        mongoose.isValidObjectId(normalizedBody.academicPeriodId)
      ) {
        const chosen = await AcademicPeriod.findOne({
          _id: new mongoose.Types.ObjectId(normalizedBody.academicPeriodId),
          schoolId: schoolIdObj,
        })
          .select("_id")
          .lean();
        if (!chosen) {
          return new Response(
            JSON.stringify({
              error:
                "Academic period not found for this school. Choose a valid term or year.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        academicPeriodObjId =
          chosen._id instanceof mongoose.Types.ObjectId
            ? chosen._id
            : new mongoose.Types.ObjectId(String(chosen._id));
      } else {
        const current = await AcademicPeriod.findOne({
          schoolId: schoolIdObj,
          isCurrent: true,
        })
          .select("_id")
          .lean();
        if (!current) {
          return new Response(
            JSON.stringify({
              error:
                "Set a current academic period for your school before assigning subjects to class groups.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        academicPeriodObjId =
          current._id instanceof mongoose.Types.ObjectId
            ? current._id
            : new mongoose.Types.ObjectId(String(current._id));
      }

      const classGroupOids = assignmentRows
        .map((r) => r.classGroupId)
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      if (classGroupOids.length !== assignmentRows.length) {
        return new Response(
          JSON.stringify({
            error: "One or more class group IDs in teaching assignments are invalid",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const classGroups = await ClassGroup.find({
        _id: { $in: classGroupOids },
        schoolId: schoolIdObj,
        isActive: true,
      })
        .select("_id subjectIds name")
        .lean();
      if (classGroups.length !== classGroupOids.length) {
        return new Response(
          JSON.stringify({
            error:
              "One or more class groups were not found, are inactive, or belong to another school",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      classGroupById = new Map(
        (classGroups as Array<{
          _id: mongoose.Types.ObjectId;
          subjectIds?: unknown;
          name?: string;
        }>).map((cg) => [String(cg._id), cg])
      );

      const subjectIdSet = new Set(subjectIds.map(String));
      for (const row of assignmentRows) {
        if (!subjectIdSet.has(row.subjectId)) {
          return new Response(
            JSON.stringify({
              error:
                "Each teaching assignment must use a subject that exists and is active for your school",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Validate homeroom class group if provided
    if (normalizedBody.homeroomClassGroupId) {
      if (!mongoose.isValidObjectId(normalizedBody.homeroomClassGroupId)) {
        return new Response(
          JSON.stringify({ error: "Invalid homeroom class group ID format" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const classGroup = await ClassGroup.findOne({
        _id: normalizedBody.homeroomClassGroupId,
        schoolId,
        isActive: true,
      }).lean();

      if (!classGroup) {
        return new Response(
          JSON.stringify({
            error: "Class group not found or not active",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Create teacher user
    const teacherUser = new User({
      email: normalizedBody.email.toLowerCase().trim(),
      firstName: normalizedBody.firstName.trim(),
      lastName: normalizedBody.lastName.trim(),
      phone: normalizedBody.phone,
      avatarUrl: normalizedBody.photoUrl,
      role: "teacher",
      schoolId: schoolIdObj,
    });

    await teacherUser.save();

    const teacherIdObj =
      teacherUser._id instanceof mongoose.Types.ObjectId
        ? teacherUser._id
        : new mongoose.Types.ObjectId(String(teacherUser._id));

    // Ensure membership entry for metrics/onboarding
    await UserMembership.findOneAndUpdate(
      { userId: teacherIdObj, schoolId: schoolIdObj },
      { $addToSet: { roles: "teacher" }, $set: { status: "active" } },
      { upsert: true }
    );

    // Persist teacher metadata (subjects + homeroom)
    const teacherRecord = new Teacher({
      schoolId: schoolIdObj,
      userId: teacherIdObj,
      subjectIds: subjectIds,
      homeroomClassGroupId: normalizedBody.homeroomClassGroupId
        ? new mongoose.Types.ObjectId(normalizedBody.homeroomClassGroupId)
        : null,
      status: normalizedBody.status || "active",
    });

    await teacherRecord.save();

    const assignmentWarnings: string[] = [];
    if (
      assignmentRows.length > 0 &&
      academicPeriodObjId &&
      classGroupById
    ) {
      for (const row of assignmentRows) {
        const subjectObjId = new mongoose.Types.ObjectId(row.subjectId);
        const classGroupObjId = new mongoose.Types.ObjectId(row.classGroupId);
        const cg = classGroupById.get(String(classGroupObjId));
        const cgSubjects = Array.isArray(cg?.subjectIds)
          ? (cg.subjectIds as mongoose.Types.ObjectId[]).map(String)
          : [];
        if (cgSubjects.length && !cgSubjects.includes(String(subjectObjId))) {
          assignmentWarnings.push(
            `“${cg?.name || "Class"}”: this subject isn’t on that class group’s list yet—the assignment was still created.`
          );
        }

        const othersOnSlot = await findOtherTeachersOnSlot({
          schoolId: schoolIdObj,
          academicPeriodId: academicPeriodObjId,
          subjectId: subjectObjId,
          classGroupId: classGroupObjId,
          requestingTeacherId: teacherRecord._id,
        });

        if (othersOnSlot.length > 0) {
          if (teachingAssignmentResolution === "skip") {
            assignmentWarnings.push(
              `Skipped “${cg?.name || "Class"}” for this subject — another teacher is already assigned for this term.`
            );
            continue;
          }
          if (teachingAssignmentResolution === "replace") {
            await deactivateOtherTeachersOnSlot({
              schoolId: schoolIdObj,
              academicPeriodId: academicPeriodObjId,
              subjectId: subjectObjId,
              classGroupId: classGroupObjId,
              keepTeacherId: teacherRecord._id,
            });
          }
        }

        try {
          await TeacherAssignment.create({
            schoolId: schoolIdObj,
            teacherId: teacherRecord._id,
            academicPeriodId: academicPeriodObjId,
            subjectId: subjectObjId,
            classGroupId: classGroupObjId,
            workloadHours: 0,
            status: "active",
            assignedBy: userId
              ? new mongoose.Types.ObjectId(String(userId))
              : null,
            assignedAt: new Date(),
          });
        } catch (err: unknown) {
          const code = (err as { code?: number })?.code;
          if (code === 11000) {
            assignmentWarnings.push(
              "Skipped a duplicate teaching assignment for this term (same subject and class)."
            );
            continue;
          }
          throw err;
        }
      }
    }

    // Assign homeroom if provided (replace previous homeroom teacher on the class if any)
    if (normalizedBody.homeroomClassGroupId) {
      const homeroomCgId = new mongoose.Types.ObjectId(
        normalizedBody.homeroomClassGroupId
      );
      const prevClass = await ClassGroup.findOne({
        _id: homeroomCgId,
        schoolId: schoolIdObj,
      })
        .select("homeroomTeacherId")
        .lean();
      const prevHt = (prevClass as { homeroomTeacherId?: mongoose.Types.ObjectId } | null)
        ?.homeroomTeacherId;
      if (prevHt && String(prevHt) !== String(teacherRecord._id)) {
        await Teacher.updateOne(
          { _id: prevHt, schoolId: schoolIdObj },
          { $unset: { homeroomClassGroupId: 1 } }
        );
      }
      await ClassGroup.updateOne(
        { _id: homeroomCgId, schoolId: schoolIdObj },
        { $set: { homeroomTeacherId: teacherRecord._id } }
      );
    }

    // Send Clerk invitation email and create invitation record
    const redirectUrl = `${getInvitationRedirectUrl()}?next=${encodeURIComponent(
      "/teacher"
    )}`;
    let clerkInvitationId: string | undefined;
    let invitationStatus: "pending" | "failed" = "pending";

    try {
      const clerk = await clerkClient();
      const clerkInvitation = await clerk.invitations.createInvitation({
        emailAddress: normalizedBody.email.toLowerCase().trim(),
        redirectUrl,
        notify: false,
        publicMetadata: {
          role: "teacher",
          schoolId: String(schoolIdObj),
        },
        ignoreExisting: true,
      });
      clerkInvitationId = clerkInvitation.id;

      // Fetch school name for email
      const school = await School.findById(schoolIdObj)
        .select("name")
        .lean();
      const schoolName = school ? (school as any).name : "your school";

      const { renderTemplate } = await import("@/lib/email/templates");
      const rendered = renderTemplate("USER_INVITE", {
        name: `${normalizedBody.firstName} ${normalizedBody.lastName}`,
        role: "teacher",
        schoolName,
        setupLink: getInvitationAcceptUrl(clerkInvitation, redirectUrl),
      });

      await sendTrackedBrevoEmail({
        to: normalizedBody.email.toLowerCase().trim(),
        subject: rendered.subject,
        htmlContent: rendered.htmlContent,
        textContent: rendered.textContent,
        templateKey: "TEACHER_INVITE",
        schoolId: String(schoolIdObj),
        schoolName,
        actorId: String(userId),
        actorRole: "school_admin",
        relatedEntityType: "invitation",
      });
      await trackUsage({
        schoolId,
        provider: "email",
        metricKey: "transactional_emails_sent",
        quantity: 1,
        unitLabel: "emails",
        allocationMethod: "direct",
        sourceType: "manual",
        notes: "Teacher invitation email sent.",
      });
    } catch (inviteError) {
      console.error("Teacher invite (Clerk and/or invite email) error:", inviteError);
      invitationStatus = "failed";
      // Don't fail the request if invitation fails - teacher is already created
      // Admin can resend invitation later if needed
    }

    // Create invitation record
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      await Invitation.create({
        email: normalizedBody.email.toLowerCase().toLowerCase().trim(),
        role: "teacher",
        schoolId: schoolIdObj,
        status: invitationStatus,
        clerkInvitationId,
        sentAt: new Date(),
        expiresAt,
        resendCount: 0,
        invitedBy: new mongoose.Types.ObjectId(userId),
        metadata: {
          firstName: normalizedBody.firstName,
          lastName: normalizedBody.lastName,
          subjectIds: mergedSubjectIdStrings,
          teachingAssignments: normalizedBody.teachingAssignments || [],
          homeroomClassGroupId: normalizedBody.homeroomClassGroupId,
        },
      });
    } catch (inviteRecordError) {
      console.error("Failed to create invitation record:", inviteRecordError);
      // Don't fail the request - invitation record is for tracking only
    }

    // Record activity
    await recordActivity({
      schoolId: String(schoolIdObj),
      userId: String(userId),
      type: "teacher.created",
      entityType: "teacher",
      entityId: String(teacherRecord._id),
      description: `Created teacher: ${normalizedBody.firstName} ${normalizedBody.lastName} (${normalizedBody.email})`,
      metadata: {
        teacherId: String(teacherRecord._id),
        email: normalizedBody.email,
        subjectIds: mergedSubjectIdStrings,
        teachingAssignments: normalizedBody.teachingAssignments || [],
        homeroomClassGroupId: normalizedBody.homeroomClassGroupId,
        invitationSent: invitationStatus === "pending",
      },
    });
    await trackUsage({
      schoolId,
      provider: "internal",
      metricKey: "teacher_records_created",
      quantity: 1,
      unitLabel: "teachers",
      allocationMethod: "manual",
      sourceType: "manual",
      notes: "Teacher created through admin workflow.",
    });
    await trackUsage({
      schoolId,
      provider: "internal",
      metricKey: "invitations_sent",
      quantity: 1,
      unitLabel: "invites",
      allocationMethod: "manual",
      sourceType: "manual",
      notes: "Teacher invitation issued during teacher creation.",
    });

    return Response.json(
      {
        success: true,
        data: {
          _id: String(teacherRecord._id),
          userId: String(teacherIdObj),
          firstName: teacherUser.firstName,
          lastName: teacherUser.lastName,
          email: teacherUser.email,
          subjectIds: subjectIds.map(String),
          teachingAssignments: normalizedBody.teachingAssignments || [],
          teachingAssignmentWarnings:
            assignmentWarnings.length > 0 ? assignmentWarnings : undefined,
          homeroomClassGroupId: normalizedBody.homeroomClassGroupId || null,
        },
      },
      { status: 201 }
    );
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("Teacher creation error:", e);
    const message = e instanceof Error ? e.message : "Failed to create teacher";

    // Handle MongoDB duplicate key errors (code 11000)
    if (e?.code === 11000) {
      const errorMsg = e?.message || "";
      if (
        errorMsg.includes("schoolId_1_email_1") ||
        errorMsg.includes("dup key") ||
        errorMsg.includes("email_1")
      ) {
        return new Response(
          JSON.stringify({
            error:
              "A user with this email already exists in your school (or the email is reserved for this school).",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (
        errorMsg.includes("schoolId_1_userId_1") ||
        errorMsg.includes("schoolId")
      ) {
        return new Response(
          JSON.stringify({
            error: "This user is already a teacher in this school",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      // Generic duplicate key error
      return new Response(
        JSON.stringify({ error: "A record with this information already exists" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle validation errors
    if (/validation|required/i.test(message)) {
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle Teacher model validation errors (e.g., homeroom class group validation)
    if (
      message.includes("Homeroom class group") ||
      message.includes("schoolId must match")
    ) {
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
