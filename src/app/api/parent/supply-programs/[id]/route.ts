import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { studentMatchesProgramAudience } from "@/lib/supply-programs/eligibility";
import { getPaidQtyBySupplyLine } from "@/lib/supply-programs/progress";
import { Guardian } from "@/models/Guardian";
import { ParentSupplyPriority } from "@/models/ParentSupplyPriority";
import { StoreProduct } from "@/models/StoreProduct";
import { Subject } from "@/models/Subject";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";
import { Student } from "@/models/Student";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireParent();
    const { id } = await ctx.params;
    const studentId = req.nextUrl.searchParams.get("studentId");

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing studentId" },
        { status: 400 }
      );
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid program id" }, { status: 400 });
    }

    await connectToDatabase();

    const sid = new mongoose.Types.ObjectId(studentId);
    const student = await Student.findOne({
      _id: sid,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id gradeId classGroupId firstName lastName")
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

    const lines = await SupplyProgramLine.find({ programId: program._id })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    const lineIds = lines.map((l) => l._id as mongoose.Types.ObjectId);
    const paidMap = await getPaidQtyBySupplyLine(
      context.schoolId,
      sid,
      lineIds
    );

    const productIds = lines.map((l) => l.storeProductId);
    const products = await StoreProduct.find({
      _id: { $in: productIds },
      schoolId: context.schoolId,
    }).lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const subjIds = lines
      .map((l) => l.subjectId)
      .filter(Boolean) as mongoose.Types.ObjectId[];
    const subjects = await Subject.find({
      _id: { $in: subjIds },
      schoolId: context.schoolId,
    })
      .select("name")
      .lean();
    const subjMap = new Map(subjects.map((s) => [String(s._id), s.name]));

    const priority = await ParentSupplyPriority.findOne({
      parentUserId: context.userId,
      studentId: sid,
      programId: program._id,
    })
      .select("orderedLineIds")
      .lean();

    const orderedLineIds = Array.isArray(priority?.orderedLineIds)
      ? priority!.orderedLineIds.map((x) => String(x))
      : [];

    const linePayload = lines.map((ln) => {
      const pid = String(ln.storeProductId);
      const prod = productMap.get(pid);
      const need = Math.max(1, ln.quantity || 1);
      const paid = paidMap.get(String(ln._id)) ?? 0;
      const remaining = Math.max(0, need - paid);
      return {
        id: String(ln._id),
        storeProductId: pid,
        productName: prod?.name || "",
        description: prod?.description || "",
        priceMinor: prod?.priceMinor ?? 0,
        currency: prod?.currency || "GHS",
        imageUrl: prod?.imageUrl || null,
        subjectId: ln.subjectId ? String(ln.subjectId) : null,
        subjectName: ln.subjectId ? subjMap.get(String(ln.subjectId)) ?? null : null,
        required: ln.required,
        quantityExpected: need,
        quantityPaid: paid,
        quantityRemaining: remaining,
        satisfied: remaining === 0,
        notes: ln.notes || "",
        sortOrder: ln.sortOrder ?? 0,
      };
    });

    const orderIndex = new Map(orderedLineIds.map((id, i) => [id, i]));
    linePayload.sort((a, b) => {
      const ai = orderIndex.get(a.id);
      const bi = orderIndex.get(b.id);
      if (ai !== undefined || bi !== undefined) {
        if (ai === undefined) return 1;
        if (bi === undefined) return -1;
        return ai - bi;
      }
      return a.sortOrder - b.sortOrder;
    });

    return NextResponse.json({
      success: true,
      data: {
        program: {
          id: String(program._id),
          name: program.name,
          description: program.description || "",
          periodLabel: program.periodLabel || "",
          purchaseByDate: program.purchaseByDate?.toISOString() || null,
          validFrom: program.validFrom?.toISOString() || null,
          validTo: program.validTo?.toISOString() || null,
        },
        student: {
          id: String(student._id),
          name: `${student.firstName} ${student.lastName}`,
        },
        lines: linePayload,
        priorityOrder: orderedLineIds,
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to load program";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
