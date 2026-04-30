import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { listBorrowerLoanHistory } from "@/lib/library/library-loan.service";

export async function GET() {
  try {
    const ctx = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const schoolId = ctx.schoolId as unknown as mongoose.Types.ObjectId;
    const student = await Student.findOne({
      userId: ctx.userId,
      schoolId,
      status: "active",
    })
      .select("_id")
      .lean();
    if (!student) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Student record not found" } },
        { status: 404 }
      );
    }
    const { items, total } = await listBorrowerLoanHistory(
      schoolId,
      "student",
      student._id as mongoose.Types.ObjectId,
      { page: 1, limit: 40 }
    );
    return NextResponse.json({
      success: true,
      data: { items, total },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
