import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Invoice } from "@/models/Invoice";
import { Guardian } from "@/models/Guardian";

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
    const guardianInfo = await verifyGuardianAccess(context.userId, id);

    // Fetch student
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: context.schoolId,
    })
      .select(
        "_id firstName lastName middleName photoUrl status classGroupId admissionNo dateOfBirth gender createdAt"
      )
      .lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Get guardian details
    const guardian = await Guardian.findOne({
      userId: context.userId,
      studentId: new mongoose.Types.ObjectId(id),
    })
      .select("relationship isPrimary")
      .lean();

    // Get class group and grade
    let classGroupName = "";
    let gradeName = "";
    if ((student as any).classGroupId) {
      const classGroup = await ClassGroup.findById((student as any).classGroupId)
        .select("name gradeId")
        .lean();
      if (classGroup) {
        classGroupName = (classGroup as any).name;
        if ((classGroup as any).gradeId) {
          const grade = await Grade.findById((classGroup as any).gradeId)
            .select("name")
            .lean();
          if (grade) {
            gradeName = (grade as any).name;
          }
        }
      }
    }

    // Get fee summary
    const invoiceSummary = await Invoice.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(id),
          schoolId: context.schoolId,
        },
      },
      {
        $group: {
          _id: null,
          totalBilled: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$amountPaid" },
          outstanding: { $sum: "$balanceDue" },
          pendingCount: {
            $sum: { $cond: [{ $in: ["$status", ["pending", "partial"]] }, 1, 0] },
          },
        },
      },
    ]);

    const feeSummary = invoiceSummary[0] || {
      totalBilled: 0,
      totalPaid: 0,
      outstanding: 0,
      pendingCount: 0,
    };

    const feeStatus: "clear" | "partial" | "owing" =
      feeSummary.outstanding === 0
        ? "clear"
        : feeSummary.outstanding > 0
        ? "owing"
        : "partial";

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: String((student as any)._id),
          firstName: (student as any).firstName,
          lastName: (student as any).lastName,
          middleName: (student as any).middleName || null,
          name: `${(student as any).firstName || ""} ${(student as any).middleName || ""} ${(student as any).lastName || ""}`.replace(/\s+/g, " ").trim(),
          photoUrl: (student as any).photoUrl || null,
          status: (student as any).status,
          classGroup: classGroupName,
          classGroupId: String((student as any).classGroupId || ""),
          grade: gradeName,
          admissionNo: (student as any).admissionNo || null,
          dateOfBirth: (student as any).dateOfBirth
            ? (student as any).dateOfBirth.toISOString()
            : null,
          gender: (student as any).gender || null,
          relationship: (guardian as any)?.relationship || "guardian",
          isPrimary: (guardian as any)?.isPrimary || false,
        },
        fees: {
          totalBilled: feeSummary.totalBilled,
          totalPaid: feeSummary.totalPaid,
          outstanding: feeSummary.outstanding,
          pendingInvoices: feeSummary.pendingCount,
          status: feeStatus,
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch ward detail:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch ward",
      },
      { status: 500 }
    );
  }
}
