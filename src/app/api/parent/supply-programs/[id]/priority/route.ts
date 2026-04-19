import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { studentMatchesProgramAudience } from "@/lib/supply-programs/eligibility";
import { Guardian } from "@/models/Guardian";
import { ParentSupplyPriority } from "@/models/ParentSupplyPriority";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";
import { Student } from "@/models/Student";

const BodySchema = z.object({
  studentId: z.string().min(1),
  orderedLineIds: z.array(z.string().min(1)),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireParent();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid program id" }, { status: 400 });
    }

    const body = BodySchema.parse(await req.json());
    if (!mongoose.Types.ObjectId.isValid(body.studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid studentId" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const sid = new mongoose.Types.ObjectId(body.studentId);
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

    const program = await SupplyProgram.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: context.schoolId,
      status: "published",
    }).lean();

    if (!program) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 }
      );
    }

    if (
      !studentMatchesProgramAudience(
        {
          _id: student._id,
          gradeId: student.gradeId,
          classGroupId: student.classGroupId,
        },
        program
      )
    ) {
      return NextResponse.json(
        { success: false, error: "This list does not apply to this student" },
        { status: 403 }
      );
    }

    const programLines = await SupplyProgramLine.find({ programId: program._id })
      .select("_id")
      .lean();
    const validIds = new Set(programLines.map((l) => String(l._id)));
    const unique = [...new Set(body.orderedLineIds)].filter((x) =>
      mongoose.Types.ObjectId.isValid(x)
    );
    for (const lid of unique) {
      if (!validIds.has(lid)) {
        return NextResponse.json(
          { success: false, error: `Invalid line id in order: ${lid}` },
          { status: 400 }
        );
      }
    }

    const orderedIds = unique.map((x) => new mongoose.Types.ObjectId(x));

    await ParentSupplyPriority.findOneAndUpdate(
      {
        parentUserId: context.userId,
        studentId: sid,
        programId: program._id,
      },
      {
        $set: {
          schoolId: context.schoolId,
          orderedLineIds: orderedIds,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to save priority";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
