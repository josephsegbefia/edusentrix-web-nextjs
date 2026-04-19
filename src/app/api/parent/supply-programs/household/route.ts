import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { publishedProgramQueryForStudent } from "@/lib/supply-programs/eligibility";
import { getPaidQtyBySupplyLine } from "@/lib/supply-programs/progress";
import { Guardian } from "@/models/Guardian";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";
import { Student } from "@/models/Student";

export async function GET() {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const links = await Guardian.find({ userId: context.userId })
      .select("studentId")
      .lean();

    const studentIds = links
      .map((g) => g.studentId)
      .filter(Boolean) as mongoose.Types.ObjectId[];

    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id firstName lastName gradeId classGroupId")
      .lean();

    const rows = await Promise.all(
      students.map(async (student) => {
        const q = publishedProgramQueryForStudent(context.schoolId, {
          _id: student._id,
          gradeId: student.gradeId,
          classGroupId: student.classGroupId,
        });

        const programs = await SupplyProgram.find(q).sort({ name: 1 }).lean();

        const programSummaries = await Promise.all(
          programs.map(async (p) => {
            const lines = await SupplyProgramLine.find({ programId: p._id })
              .select("_id required quantity")
              .lean();
            const lineIds = lines.map((l) => l._id as mongoose.Types.ObjectId);
            const paidMap = await getPaidQtyBySupplyLine(
              context.schoolId,
              student._id,
              lineIds
            );

            let requiredTotal = 0;
            let requiredDone = 0;
            for (const ln of lines) {
              if (!ln.required) continue;
              const need = Math.max(1, ln.quantity || 1);
              const paid = paidMap.get(String(ln._id)) ?? 0;
              requiredTotal += 1;
              if (paid >= need) requiredDone += 1;
            }

            return {
              id: String(p._id),
              name: p.name,
              periodLabel: p.periodLabel || "",
              requiredProgress: {
                done: requiredDone,
                total: requiredTotal,
                complete: requiredTotal > 0 && requiredDone === requiredTotal,
              },
            };
          })
        );

        return {
          student: {
            id: String(student._id),
            name: `${student.firstName} ${student.lastName}`,
          },
          programs: programSummaries,
        };
      })
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to load household summary";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
