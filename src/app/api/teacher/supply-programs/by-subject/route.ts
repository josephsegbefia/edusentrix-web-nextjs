import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { getEffectiveSubjectIdsForStudent } from "@/lib/supply-programs/effectiveSubjects";
import { getPaidQtyBySupplyLine } from "@/lib/supply-programs/progress";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";

/**
 * Subject teachers: lines linked to this subject — who has paid for required quantity.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireTeacher({ mode: "api" });
    const subjectId = req.nextUrl.searchParams.get("subjectId");
    if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid subjectId" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const subOid = new mongoose.Types.ObjectId(subjectId);

    const teacher = await Teacher.findOne({
      _id: ctx.teacherId,
      schoolId: ctx.schoolId,
    })
      .select("subjectIds")
      .lean();

    const teacherSubjects = (teacher?.subjectIds || []).map((x) => String(x));
    if (!teacherSubjects.includes(String(subOid))) {
      return NextResponse.json(
        { success: false, error: "You are not assigned to this subject" },
        { status: 403 }
      );
    }

    const students = await Student.find({
      schoolId: ctx.schoolId,
      status: "active",
    })
      .select("_id firstName lastName classGroupId subjectAddIds subjectRemoveIds")
      .lean();

    const relevantStudents: typeof students = [];
    for (const st of students) {
      const effective = await getEffectiveSubjectIdsForStudent(st);
      if (effective.some((id) => String(id) === String(subOid))) {
        relevantStudents.push(st);
      }
    }

    const programs = await SupplyProgram.find({
      schoolId: ctx.schoolId,
      status: "published",
    })
      .select("_id")
      .lean();
    const programIds = programs.map((p) => p._id);

    const lines = await SupplyProgramLine.find({
      programId: { $in: programIds },
      subjectId: subOid,
    })
      .select("programId _id quantity")
      .lean();

    const publishedLines = lines;

    const lineIds = publishedLines.map((l) => l._id as mongoose.Types.ObjectId);

    const studentRows = await Promise.all(
      relevantStudents.map(async (st) => {
        const paidMap =
          lineIds.length > 0
            ? await getPaidQtyBySupplyLine(ctx.schoolId, st._id, lineIds)
            : new Map<string, number>();

        const lineStatuses = publishedLines.map((ln) => {
          const need = Math.max(1, ln.quantity || 1);
          const paid = paidMap.get(String(ln._id)) ?? 0;
          return {
            lineId: String(ln._id),
            programId: String(ln.programId),
            quantityExpected: need,
            quantityPaid: paid,
            hasMaterial: paid >= need,
          };
        });

        return {
          studentId: String(st._id),
          name: `${st.firstName} ${st.lastName}`,
          lines: lineStatuses,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        subjectId: String(subOid),
        lineDefinitions: publishedLines.map((ln) => ({
          id: String(ln._id),
          programId: String(ln.programId),
          quantityExpected: Math.max(1, ln.quantity || 1),
        })),
        students: studentRows,
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to load subject supplies";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
