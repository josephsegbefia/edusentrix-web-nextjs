/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Application } from "@/models/Application";
import { Student } from "@/models/Student";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { recordApplicationAudit } from "@/lib/audit/recordApplicationAudit";
import { enforceSchoolLimit } from "@/lib/auth/checkLimit";
import { trackUsage } from "@/lib/billing/trackUsage";

export const runtime = "nodejs";

const BodySchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional().nullable(),
  gradeId: z.string(),
  classGroupId: z.string(),
  sex: z.enum(["male", "female"]).optional(),
  dateOfBirth: z.string().optional().nullable(),
  admissionNo: z.string().trim().max(40).optional().nullable(),
});

/**
 * Create the first Student for an approved application’s school and link both records.
 * Guardians and fees are handled in the school admin workspace.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.res;

  const platformAdminId = new mongoose.Types.ObjectId(
    String((guard.me as any)?._id)
  );

  const { id } = await ctx.params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await connectToDatabase();

  const app = await Application.findById(id);
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (app.status !== "approved") {
    return NextResponse.json(
      { error: "Application must be approved before enrolling a student." },
      { status: 400 }
    );
  }

  if (!app.linkedSchoolId) {
    return NextResponse.json(
      { error: "Application has no linked school." },
      { status: 400 }
    );
  }

  if (app.enrolledStudentId) {
    return NextResponse.json(
      {
        error: "A student is already linked to this application.",
        studentId: String(app.enrolledStudentId),
      },
      { status: 409 }
    );
  }

  const schoolId = app.linkedSchoolId as mongoose.Types.ObjectId;

  try {
    await enforceSchoolLimit({
      schoolId,
      limitKey: "maxStudents",
      message: "The student limit for this school’s subscription has been reached.",
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const grade = await Grade.findOne({
    _id: parsed.data.gradeId,
    schoolId,
    isActive: true,
  }).lean();

  if (!grade) {
    return NextResponse.json(
      { error: "Grade not found or not active for this school." },
      { status: 400 }
    );
  }

  const classGroup = await ClassGroup.findOne({
    _id: parsed.data.classGroupId,
    schoolId,
    gradeId: grade._id,
    isActive: true,
  }).lean();

  if (!classGroup) {
    return NextResponse.json(
      {
        error:
          "Class group not found, not active, or does not match the selected grade.",
      },
      { status: 400 }
    );
  }

  const student = new Student({
    schoolId,
    platformApplicationId: app._id,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    middleName: parsed.data.middleName?.trim() || null,
    gradeId: grade._id,
    classGroupId: classGroup._id,
    admissionNo: parsed.data.admissionNo?.trim() || null,
    sex: parsed.data.sex ?? "male",
    dateOfBirth: parsed.data.dateOfBirth
      ? new Date(parsed.data.dateOfBirth)
      : null,
    status: "active",
    enrolledAt: new Date(),
  });

  await student.save();

  app.enrolledStudentId = student._id as any;
  await app.save();

  await recordApplicationAudit({
    applicationId: app._id,
    action: "student_enrolled",
    by: platformAdminId,
    meta: {
      studentId: String(student._id),
      schoolId: String(schoolId),
      firstName: student.firstName,
      lastName: student.lastName,
      gradeId: String(grade._id),
      classGroupId: String(classGroup._id),
    },
  });

  await trackUsage({
    schoolId,
    provider: "internal",
    metricKey: "student_records_created",
    quantity: 1,
    unitLabel: "students",
    allocationMethod: "manual",
    sourceType: "manual",
    notes: "CRM-lite: student enrolled from platform application.",
  });

  return NextResponse.json({
    success: true,
    data: {
      studentId: String(student._id),
      schoolId: String(schoolId),
      firstName: student.firstName,
      lastName: student.lastName,
    },
  });
}
