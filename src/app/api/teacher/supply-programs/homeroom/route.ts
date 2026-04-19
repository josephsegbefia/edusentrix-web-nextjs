import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { publishedProgramQueryForStudent } from "@/lib/supply-programs/eligibility";
import { getPaidQtyBySupplyLine } from "@/lib/supply-programs/progress";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";
import { Student } from "@/models/Student";

/**
 * Homeroom teachers: read-only completion of required supplies per student in homeroom class.
 */
export async function GET() {
  try {
    const ctx = await requireTeacher({ mode: "api" });
    await connectToDatabase();

    if (!ctx.homeroomClassGroupId) {
      return NextResponse.json({
        success: true,
        data: {
          homeroomClassGroupId: null,
          students: [],
          message: "No homeroom class assigned",
        },
      });
    }

    const classId = ctx.homeroomClassGroupId;

    const students = await Student.find({
      schoolId: ctx.schoolId,
      classGroupId: classId,
      status: "active",
    })
      .select("_id firstName lastName gradeId classGroupId")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const studentRows = await Promise.all(
      students.map(async (st) => {
        const q = publishedProgramQueryForStudent(ctx.schoolId, {
          _id: st._id,
          gradeId: st.gradeId,
          classGroupId: st.classGroupId,
        });
        const programs = await SupplyProgram.find(q)
          .select("_id name periodLabel")
          .sort({ name: 1 })
          .lean();

        const programProgress = await Promise.all(
          programs.map(async (p) => {
            const lines = await SupplyProgramLine.find({ programId: p._id })
              .select("_id required quantity")
              .lean();
            const lineIds = lines.map((l) => l._id as mongoose.Types.ObjectId);
            const paidMap = await getPaidQtyBySupplyLine(
              ctx.schoolId,
              st._id,
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
              programId: String(p._id),
              programName: p.name,
              periodLabel: p.periodLabel || "",
              requiredDone,
              requiredTotal,
              allRequiredComplete:
                requiredTotal > 0 && requiredDone === requiredTotal,
            };
          })
        );

        return {
          studentId: String(st._id),
          name: `${st.firstName} ${st.lastName}`,
          programs: programProgress,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        homeroomClassGroupId: String(classId),
        students: studentRows,
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to load homeroom supplies";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
