/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { buildStudentAcademicsDTO } from "@/lib/academics/buildStudentAcademicsDTO";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    // Verify guardian access
    await verifyGuardianAccess(context.userId, id);

    // Verify student exists in school
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: context.schoolId,
    })
      .select("_id")
      .lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const url = new URL(req.url);
    const termId =
      url.searchParams.get("termId") ?? url.searchParams.get("periodId");

    const academics = await buildStudentAcademicsDTO({
      schoolId: context.schoolId,
      studentId: id,
      academicPeriodId: termId,
    });

    return NextResponse.json({
      success: true,
      data: academics,
    });
  } catch (error: any) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch ward academics:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch academics",
      },
      { status: 500 }
    );
  }
}
