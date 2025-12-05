/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/students/[id]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { StudentDetailDTO } from "@/types/admin/student";

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = context.params;

  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const student = await Student.findOne({
      _id: id,
      schoolId,
    })
      .populate("gradeId", "name")
      .populate("classGroupId", "name gradeId")
      .lean();

    if (!student) {
      return new Response(
        JSON.stringify({ success: false, error: "Student not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const s: any = student;
    const grade = s.gradeId as any | null;
    const classGroup = s.classGroupId as any | null;

    const firstName: string = s.firstName;
    const lastName: string = s.lastName;
    const middleName: string | null = s.middleName ?? null;
    const fullName = [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ");

    const detail: StudentDetailDTO = {
      id: String(s._id),
      admissionNumber: s.admissionNumber ?? null,
      firstName,
      middleName,
      lastName,
      fullName,
      sex: s.sex ?? null,
      dateOfBirth: s.dateOfBirth ? s.dateOfBirth.toISOString() : null,
      photoUrl: s.photoUrl ?? null,

      gradeId: grade?._id ? String(grade._id) : grade ? String(grade) : null,
      gradeName: grade?.name ?? null,
      classGroupId: classGroup?._id
        ? String(classGroup._id)
        : classGroup
        ? String(classGroup)
        : null,
      classGroupName: classGroup?.name ?? null,

      status: s.status,
      enrolledAt: s.enrolledAt ? s.enrolledAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),

      // Placeholders for now
      feeStatus: "unknown",
      amountOwed: 0,
      latestAverage: null,
      academicBadge: "none",
    };

    return Response.json({ success: true, data: detail }, { status: 200 });
  } catch (error: unknown) {
    console.error("Failed to fetch student:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch student";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
