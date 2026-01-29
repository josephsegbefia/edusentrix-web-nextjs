import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { Invoice } from "@/models/Invoice";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";

export async function GET() {
  try {
    const context = await requireParent();
    await connectToDatabase();

    // Get all wards for this parent
    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId relationship isPrimary")
      .lean();

    if (!guardians.length) {
      return NextResponse.json({
        success: true,
        data: {
          wards: [],
        },
      });
    }

    const studentIds = guardians.map(
      (g) => (g as unknown as { studentId: mongoose.Types.ObjectId }).studentId
    );

    // Fetch students with more details
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
    })
      .select("_id firstName lastName middleName photoUrl status classGroupId admissionNo")
      .lean();

    // Get class group names and grade info
    const classGroupIds = students
      .map((s: any) => s.classGroupId)
      .filter(Boolean);
    
    const classGroups = await ClassGroup.find({ _id: { $in: classGroupIds } })
      .select("_id name gradeId")
      .lean();
    
    const classGroupMap = new Map(
      classGroups.map((cg: any) => [String(cg._id), { name: cg.name, gradeId: cg.gradeId }])
    );

    // Get grade names
    const gradeIds = classGroups
      .map((cg: any) => cg.gradeId)
      .filter(Boolean);
    
    const grades = await Grade.find({ _id: { $in: gradeIds } })
      .select("_id name")
      .lean();
    
    const gradeMap = new Map(
      grades.map((g: any) => [String(g._id), g.name])
    );

    // Get fee summaries for all wards
    const invoiceSummary = await Invoice.aggregate([
      {
        $match: {
          studentId: { $in: studentIds },
          schoolId: context.schoolId,
          status: { $in: ["pending", "partial"] },
        },
      },
      {
        $group: {
          _id: "$studentId",
          outstanding: { $sum: "$balanceDue" },
        },
      },
    ]);

    const outstandingMap = new Map(
      invoiceSummary.map((s: any) => [String(s._id), s.outstanding])
    );

    // Build guardian relationship map
    const guardianMap = new Map(
      guardians.map((g: any) => [
        String(g.studentId),
        { relationship: g.relationship, isPrimary: g.isPrimary },
      ])
    );

    // Build wards list
    const wards = students.map((student: any) => {
      const outstanding = outstandingMap.get(String(student._id)) || 0;
      const guardianInfo = guardianMap.get(String(student._id));
      const classGroupInfo = classGroupMap.get(String(student.classGroupId));
      const gradeName = classGroupInfo?.gradeId 
        ? gradeMap.get(String(classGroupInfo.gradeId)) 
        : null;

      const feeStatus: "clear" | "partial" | "owing" =
        outstanding === 0 ? "clear" : outstanding > 0 ? "owing" : "partial";

      return {
        id: String(student._id),
        name: `${student.firstName || ""} ${student.middleName || ""} ${student.lastName || ""}`.replace(/\s+/g, " ").trim(),
        firstName: student.firstName,
        lastName: student.lastName,
        photoUrl: student.photoUrl || null,
        classGroup: classGroupInfo?.name || "",
        classGroupId: String(student.classGroupId || ""),
        grade: gradeName || null,
        admissionNo: student.admissionNo || null,
        status: student.status,
        relationship: guardianInfo?.relationship || "guardian",
        isPrimary: guardianInfo?.isPrimary || false,
        feeStatus,
        outstandingAmount: outstanding,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        wards,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch parent wards:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch wards",
      },
      { status: 500 }
    );
  }
}
