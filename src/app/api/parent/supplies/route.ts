import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import { publishedProgramQueryForStudent } from "@/lib/supply-programs/eligibility";
import { getPaidQtyBySupplyLine } from "@/lib/supply-programs/progress";
import { ClassGroup } from "@/models/ClassGroup";
import { StoreProduct } from "@/models/StoreProduct";
import { Student } from "@/models/Student";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireParent();
    await connectToDatabase();
    const requestedWardId = req.nextUrl.searchParams.get("wardId");
    const wardIds = await getParentWardIds(ctx.userId);
    const scopedWardIds =
      requestedWardId && wardIds.some((id) => String(id) === requestedWardId)
        ? [new mongoose.Types.ObjectId(requestedWardId)]
        : wardIds;
    const students = await Student.find({ _id: { $in: scopedWardIds }, schoolId: ctx.schoolId, status: "active" })
      .select("_id firstName lastName gradeId classGroupId")
      .lean();
    const classGroups = await ClassGroup.find({ _id: { $in: students.map((s) => s.classGroupId).filter(Boolean) } })
      .select("_id name")
      .lean();
    const classById = new Map(classGroups.map((cg) => [String(cg._id), cg.name || null]));

    const programs = (
      await Promise.all(
        students.map(async (student) => {
          const rows = await SupplyProgram.find(
            publishedProgramQueryForStudent(ctx.schoolId, {
              _id: student._id,
              gradeId: student.gradeId,
              classGroupId: student.classGroupId,
            })
          ).lean();
          return Promise.all(
            rows.map(async (program) => {
              const lines = await SupplyProgramLine.find({ programId: program._id }).lean();
              const products = await StoreProduct.find({ _id: { $in: lines.map((line) => line.storeProductId) } })
                .select("_id priceMinor")
                .lean();
              const productById = new Map(products.map((p) => [String(p._id), p]));
              const paidMap = await getPaidQtyBySupplyLine(
                ctx.schoolId,
                student._id,
                lines.map((line) => line._id as mongoose.Types.ObjectId)
              );
              const purchasedCount = lines.filter((line) => {
                const need = Math.max(1, line.quantity || 1);
                return (paidMap.get(String(line._id)) ?? 0) >= need;
              }).length;
              const estimatedTotal = lines.reduce((sum, line) => {
                const product = productById.get(String(line.storeProductId));
                return sum + ((product?.priceMinor ?? 0) / 100) * Math.max(1, line.quantity || 1);
              }, 0);
              return {
                id: String(program._id),
                title: program.name,
                wardId: String(student._id),
                wardName: `${student.firstName} ${student.lastName}`,
                classGroup: student.classGroupId ? classById.get(String(student.classGroupId)) ?? null : null,
                totalItems: lines.length,
                purchasedCount,
                estimatedTotal: estimatedTotal || null,
              };
            })
          );
        })
      )
    ).flat();

    return NextResponse.json({
      success: true,
      data: {
        programs,
        householdTotal: programs.reduce((sum, program) => sum + (program.estimatedTotal ?? 0), 0) || null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load supplies";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
