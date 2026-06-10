import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { searchExistingGuardiansForStudent } from "@/lib/guardians/guardian-linking";

function toObjectIdOrNull(value: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("students");
    await connectToDatabase();

    const { id } = await ctx.params;
    const studentId = toObjectIdOrNull(id);
    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = toObjectIdOrNull(String(schoolId));
    if (!schoolIdObj) {
      return NextResponse.json(
        { success: false, error: "School ID not found" },
        { status: 400 }
      );
    }

    const student = await Student.findOne({
      _id: studentId,
      schoolId: schoolIdObj,
    })
      .select("_id")
      .lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const query = req.nextUrl.searchParams.get("q") || "";
    const data = await searchExistingGuardiansForStudent({
      schoolId: schoolIdObj,
      studentId,
      query,
      limit: 8,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Existing guardian search failed:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to search existing guardians",
      },
      { status: 500 }
    );
  }
}
