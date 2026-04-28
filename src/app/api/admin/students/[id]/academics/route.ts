/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { Student } from "@/models/Student";
import mongoose from "mongoose";
import { buildStudentAcademicsDTO } from "@/lib/academics/buildStudentAcademicsDTO";
import { connectToDatabase } from "@/db/connectToDatabase";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("students");
    await connectToDatabase();

    if (!schoolId) {
      return new Response(
        JSON.stringify({ success: false, error: "School ID not found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Same pattern as other routes
    const schoolObjectId =
      schoolId instanceof mongoose.Types.ObjectId ? schoolId : schoolId;

    const student = await Student.findOne({
      _id: id,
      schoolId: schoolObjectId,
    })
      .select("_id")
      .lean();

    if (!student) {
      return new Response(
        JSON.stringify({ success: false, error: "Student not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const termId =
      url.searchParams.get("termId") ?? url.searchParams.get("periodId");

    const academics = await buildStudentAcademicsDTO({
      schoolId: schoolObjectId,
      studentId: id,
      academicPeriodId: termId,
    });

    return new Response(JSON.stringify({ success: true, data: academics }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Failed to fetch student academics", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch student academics";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
