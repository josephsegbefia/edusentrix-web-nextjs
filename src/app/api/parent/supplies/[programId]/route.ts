import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import { publishedProgramQueryForStudent } from "@/lib/supply-programs/eligibility";
import { getPaidQtyBySupplyLine } from "@/lib/supply-programs/progress";
import { StoreProduct } from "@/models/StoreProduct";
import { Student } from "@/models/Student";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";

type Params = Promise<{ programId: string }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const ctx = await requireParent();
    const { programId } = await params;
    await connectToDatabase();
    const wardIds = await getParentWardIds(ctx.userId);
    const requestedWardId = req.nextUrl.searchParams.get("wardId");
    const wardId = requestedWardId && wardIds.some((id) => String(id) === requestedWardId) ? requestedWardId : String(wardIds[0] ?? "");
    if (!wardId) return NextResponse.json({ success: false, error: "No linked child" }, { status: 404 });
    const student = await Student.findOne({ _id: wardId, schoolId: ctx.schoolId, status: "active" })
      .select("_id firstName lastName gradeId classGroupId")
      .lean();
    if (!student) return NextResponse.json({ success: false, error: "Child not found" }, { status: 404 });
    const program = await SupplyProgram.findOne({
      _id: programId,
      ...publishedProgramQueryForStudent(ctx.schoolId, {
        _id: student._id,
        gradeId: student.gradeId,
        classGroupId: student.classGroupId,
      }),
    }).lean();
    if (!program) return NextResponse.json({ success: false, error: "Supply list not found" }, { status: 404 });

    const lines = await SupplyProgramLine.find({ programId: program._id }).sort({ sortOrder: 1 }).lean();
    const products = await StoreProduct.find({ _id: { $in: lines.map((line) => line.storeProductId) } }).lean();
    const productById = new Map(products.map((product) => [String(product._id), product]));
    const paidMap = await getPaidQtyBySupplyLine(
      ctx.schoolId,
      student._id,
      lines.map((line) => line._id as mongoose.Types.ObjectId)
    );
    const items = lines.map((line) => {
      const product = productById.get(String(line.storeProductId));
      const need = Math.max(1, line.quantity || 1);
      return {
        id: String(line._id),
        name: product?.name || "Supply item",
        quantity: need,
        estimatedCost: product ? (product.priceMinor || 0) / 100 : null,
        isPriority: false,
        isPurchased: (paidMap.get(String(line._id)) ?? 0) >= need,
        storeProductId: product ? String(product._id) : null,
      };
    });
    return NextResponse.json({
      success: true,
      data: {
        id: String(program._id),
        title: program.name,
        wardId: String(student._id),
        wardName: `${student.firstName} ${student.lastName}`,
        classGroup: null,
        totalItems: items.length,
        purchasedCount: items.filter((item) => item.isPurchased).length,
        estimatedTotal: items.reduce((sum, item) => sum + (item.estimatedCost ?? 0) * item.quantity, 0) || null,
        items,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load supply list";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
