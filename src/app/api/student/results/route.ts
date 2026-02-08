import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { buildStudentAcademicsDTO } from "@/lib/academics/buildStudentAcademicsDTO";
import { Student } from "@/models/Student";

type StudentLookupRow = {
  _id: mongoose.Types.ObjectId;
};

export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();

    const student = (await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id")
      .lean()) as StudentLookupRow | null;

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get("periodId");
    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return NextResponse.json(
        { success: false, error: "Invalid periodId" },
        { status: 400 }
      );
    }

    const academics = await buildStudentAcademicsDTO({
      schoolId: context.schoolId,
      studentId: student._id,
      academicPeriodId: periodId || null,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...academics,
        // Students should only see comments marked as public.
        comments: (academics.comments || []).filter((comment) => comment.isPublic),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to fetch student results:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch student results",
      },
      { status: 500 }
    );
  }
}
