/* eslint-disable @typescript-eslint/no-explicit-any */
// POST /api/students/create
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import mongoose from "mongoose";
import { createStudentForSchool, StudentCreationError } from "@/lib/students/create-student-service";
import { StorageValidationError } from "@/lib/storage/types";
import { SchoolWriteAccessError } from "@/lib/billing/require-school-write-access";

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
  status: "active" | "inactive" | "withdrawn" | "graduated";
  enrolledAt?: string; // ISO date string
  subjectAddIds?: string[];
  subjectRemoveIds?: string[];
};

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const body = (await req.json()) as Body;

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.gradeId || !body.classGroupId) {
      return new Response("Missing required fields", { status: 400 });
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const student = await createStudentForSchool({
      schoolId: schoolIdObj,
      firstName: body.firstName,
      middleName: body.middleName,
      lastName: body.lastName,
      gradeId: body.gradeId,
      classGroupId: body.classGroupId,
      admissionNo: body.admissionNo,
      sex: body.sex,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      photoUrl: body.photoUrl,
      status: body.status || "active",
      enrolledAt: body.enrolledAt ? new Date(body.enrolledAt) : null,
      subjectAddIds: body.subjectAddIds,
      subjectRemoveIds: body.subjectRemoveIds,
      gesIndexNumber: (body as Record<string, unknown>).gesIndexNumber as string | undefined,
      gesSchoolCode: (body as Record<string, unknown>).gesSchoolCode as string | undefined,
    });

    // No manual emit: SSE route watches Student and will push `students.updated`
    return Response.json(
      {
        success: true,
        data: {
          _id: String(student._id),
          firstName: student.firstName,
          lastName: student.lastName,
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    if (e instanceof StorageValidationError) {
      return new Response(e.message, { status: 400 });
    }
    if (e instanceof SchoolWriteAccessError) {
      return Response.json(
        { success: false, error: e.message, accessMode: e.accessMode },
        { status: e.statusCode }
      );
    }
    if (e instanceof StudentCreationError) {
      return new Response(e.message, { status: e.code === "LIMIT_REACHED" ? 403 : 400 });
    }
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
