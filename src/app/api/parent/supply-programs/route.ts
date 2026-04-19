import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { publishedProgramQueryForStudent } from "@/lib/supply-programs/eligibility";
import { getPaidQtyBySupplyLine } from "@/lib/supply-programs/progress";
import { Guardian } from "@/models/Guardian";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";
import { Student } from "@/models/Student";

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing studentId" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const sid = new mongoose.Types.ObjectId(studentId);
    const student = await Student.findOne({
      _id: sid,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id gradeId classGroupId")
      .lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const guardian = await Guardian.findOne({
      userId: context.userId,
      studentId: sid,
    }).select("_id");
    if (!guardian) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this student" },
        { status: 403 }
      );
    }

    const q = publishedProgramQueryForStudent(context.schoolId, {
      _id: student._id,
      gradeId: student.gradeId,
      classGroupId: student.classGroupId,
    });

    const programs = await SupplyProgram.find(q).sort({ purchaseByDate: 1, name: 1 }).lean();

    const summaries = await Promise.all(
      programs.map(async (p) => {
        const lines = await SupplyProgramLine.find({ programId: p._id })
          .select("_id required quantity")
          .lean();
        const lineIds = lines.map((l) => l._id as mongoose.Types.ObjectId);
        const paidMap = await getPaidQtyBySupplyLine(
          context.schoolId,
          sid,
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
          purchaseByDate: p.purchaseByDate?.toISOString() || null,
          validFrom: p.validFrom?.toISOString() || null,
          validTo: p.validTo?.toISOString() || null,
          requiredProgress: {
            done: requiredDone,
            total: requiredTotal,
            complete: requiredTotal > 0 && requiredDone === requiredTotal,
          },
        };
      })
    );

    return NextResponse.json({ success: true, data: summaries });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to load programs";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
