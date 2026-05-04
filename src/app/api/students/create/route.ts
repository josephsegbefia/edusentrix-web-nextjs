/* eslint-disable @typescript-eslint/no-explicit-any */
// POST /api/students/create
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject, type ISubject } from "@/models/Subject";
import mongoose from "mongoose";
import { enforceSchoolLimit } from "@/lib/auth/checkLimit";
import { trackUsage } from "@/lib/billing/trackUsage";
import { allocateSyntheticTestEmail } from "@/lib/internal-test/allocate-synthetic-test-email";
import { createSyntheticClerkAccount } from "@/lib/internal-test/create-synthetic-clerk-account";
import { getInternalTestDefaultPassword } from "@/lib/internal-test/env";
import { loadSchoolInternalTestSnapshot } from "@/lib/internal-test/load-internal-test-context";
import { shouldUseSyntheticTestUserFlow } from "@/lib/internal-test/synthetic-test-user-flow";

type Body = {
  firstName: string;
  middleName?: string;
  lastName: string;
  gradeId: string;
  classGroupId: string;
  admissionNo?: string;
  sex?: "male" | "female";
  dateOfBirth?: string; // ISO date string
  photoUrl?: string;
  status: "active" | "inactive" | "withdrawn";
  enrolledAt?: string; // ISO date string
  subjectAddIds?: string[];
  subjectRemoveIds?: string[];
  /** When the school uses the synthetic internal-test user flow, provisions a Clerk-backed student portal login. */
  provisionTestPortalAccount?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await enforceSchoolLimit({
      schoolId,
      limitKey: "maxStudents",
      message: "The student limit for this subscription has been reached.",
    });
    await connectToDatabase();

    const body = (await req.json()) as Body;

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.gradeId || !body.classGroupId) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Validate grade exists and belongs to school
    const grade = await Grade.findOne({
      _id: body.gradeId,
      schoolId,
      isActive: true,
    }).lean();

    if (!grade) {
      return new Response("Grade not found or not active", { status: 400 });
    }

    // Validate class group exists, belongs to school, and matches grade
    const classGroup = await ClassGroup.findOne({
      _id: body.classGroupId,
      schoolId,
      gradeId: body.gradeId,
      isActive: true,
    }).lean();

    if (!classGroup) {
      return new Response(
        "Class group not found, not active, or does not belong to selected grade",
        { status: 400 }
      );
    }

    // Validate subject IDs if provided
    let subjectAddIds: mongoose.Types.ObjectId[] = [];
    if (body.subjectAddIds && body.subjectAddIds.length > 0) {
      const subs = (await Subject.find({
        _id: { $in: body.subjectAddIds },
        schoolId,
        isActive: true,
      }).lean()) as unknown as ISubject[];
      subjectAddIds = subs.map((s: ISubject) => {
        const id = s._id;
        return id instanceof mongoose.Types.ObjectId
          ? id
          : new mongoose.Types.ObjectId(String(id));
      });
      if (subjectAddIds.length !== body.subjectAddIds.length) {
        return new Response("One or more subject IDs are invalid", { status: 400 });
      }
    }

    let subjectRemoveIds: mongoose.Types.ObjectId[] = [];
    if (body.subjectRemoveIds && body.subjectRemoveIds.length > 0) {
      const subs = (await Subject.find({
        _id: { $in: body.subjectRemoveIds },
        schoolId,
        isActive: true,
      }).lean()) as unknown as ISubject[];
      subjectRemoveIds = subs.map((s: ISubject) => {
        const id = s._id;
        return id instanceof mongoose.Types.ObjectId
          ? id
          : new mongoose.Types.ObjectId(String(id));
      });
      if (subjectRemoveIds.length !== body.subjectRemoveIds.length) {
        return new Response("One or more subject IDs are invalid", { status: 400 });
      }
    }

    // Ensure no overlap between add and remove
    const addSet = new Set(subjectAddIds.map((id) => String(id)));
    const removeSet = new Set(subjectRemoveIds.map((id) => String(id)));
    for (const id of addSet) {
      if (removeSet.has(id)) {
        return new Response("A subject cannot be both added and excluded", {
          status: 400,
        });
      }
    }

    // Create student
    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const student = new Student({
      schoolId: schoolIdObj,
      firstName: body.firstName.trim(),
      middleName: body.middleName?.trim() || null,
      lastName: body.lastName.trim(),
      gradeId: new mongoose.Types.ObjectId(body.gradeId),
      classGroupId: new mongoose.Types.ObjectId(body.classGroupId),
      admissionNo: body.admissionNo?.trim() || null,
      sex: body.sex || undefined,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      photoUrl: body.photoUrl || null,
      status: body.status || "active",
      enrolledAt: body.enrolledAt ? new Date(body.enrolledAt) : null,
      subjectAddIds: subjectAddIds.length > 0 ? subjectAddIds : undefined,
      subjectRemoveIds: subjectRemoveIds.length > 0 ? subjectRemoveIds : undefined,
      gesIndexNumber: (body as Record<string, unknown>).gesIndexNumber || null,
      gesSchoolCode: (body as Record<string, unknown>).gesSchoolCode || null,
    });

    await student.save();

    let portalAccount: { email: string; userId: string } | undefined;

    if (body.provisionTestPortalAccount === true) {
      const internalTestSnapshot = await loadSchoolInternalTestSnapshot(schoolIdObj);
      if (shouldUseSyntheticTestUserFlow(internalTestSnapshot)) {
        const pwd = getInternalTestDefaultPassword();
        if (!pwd) {
          return new Response(
            JSON.stringify({
              success: false,
              error:
                "INTERNAL_TEST_DEFAULT_PASSWORD is not configured. Cannot provision a test student portal account.",
              code: "INTERNAL_TEST_PASSWORD_NOT_CONFIGURED",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }

        const syntheticEmail = await allocateSyntheticTestEmail(
          schoolIdObj,
          "student"
        );

        let studentUserId: mongoose.Types.ObjectId | null = null;
        try {
          const studentUser = await User.create({
            email: syntheticEmail,
            firstName: body.firstName.trim(),
            lastName: body.lastName.trim(),
            role: "student",
            schoolId: schoolIdObj,
            isTestUser: true,
            testUserSource: "manual_test_school",
            pendingOnboarding: false,
          });
          studentUserId =
            studentUser._id instanceof mongoose.Types.ObjectId
              ? studentUser._id
              : new mongoose.Types.ObjectId(String(studentUser._id));

          await UserMembership.findOneAndUpdate(
            { userId: studentUserId, schoolId: schoolIdObj },
            { $addToSet: { roles: "student" }, $set: { status: "active" } },
            { upsert: true }
          );

          const { clerkUserId } = await createSyntheticClerkAccount({
            email: syntheticEmail,
            password: pwd,
            firstName: body.firstName.trim(),
            lastName: body.lastName.trim(),
            role: "student",
            schoolId: schoolIdObj,
          });

          await User.updateOne({ _id: studentUserId }, { $set: { clerkUserId } });

          await Student.updateOne(
            { _id: student._id, schoolId: schoolIdObj },
            { $set: { userId: studentUserId } }
          );

          portalAccount = {
            email: syntheticEmail,
            userId: String(studentUserId),
          };
        } catch (portalErr) {
          console.error("Synthetic student portal provisioning failed:", portalErr);
          if (studentUserId) {
            try {
              await UserMembership.deleteMany({ userId: studentUserId });
              await User.deleteOne({ _id: studentUserId });
            } catch {
              /* ignore */
            }
          }
          return new Response(
            JSON.stringify({
              success: false,
              error:
                portalErr instanceof Error
                  ? portalErr.message
                  : "Failed to provision test student portal account",
              code: "SYNTHETIC_STUDENT_PORTAL_FAILED",
              data: {
                _id: String(student._id),
                firstName: student.firstName,
                lastName: student.lastName,
              },
            }),
            { status: 502, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    await trackUsage({
      schoolId,
      provider: "internal",
      metricKey: "student_records_created",
      quantity: 1,
      unitLabel: "students",
      allocationMethod: "manual",
      sourceType: "manual",
      notes: "Student created through admin workflow.",
    });

    // No manual emit: SSE route watches Student and will push `students.updated`
    return Response.json(
      {
        success: true,
        data: {
          _id: String(student._id),
          firstName: student.firstName,
          lastName: student.lastName,
          ...(portalAccount ? { portalAccount } : {}),
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Student creation error:", e);
    const message =
      e instanceof Error ? e.message : "Failed to create student";

    // Handle duplicate admission number error
    if (message.includes("admissionNo") || message.includes("duplicate")) {
      return new Response("Admission number already exists", { status: 400 });
    }

    // Handle validation errors from mongoose pre-save hooks
    if (
      message.includes("ClassGroup") ||
      message.includes("Grade") ||
      message.includes("schoolId")
    ) {
      return new Response(message, { status: 400 });
    }

    return new Response(message, { status: 500 });
  }
}
