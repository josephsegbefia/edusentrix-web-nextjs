import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { StoreProduct } from "@/models/StoreProduct";
import { Subject } from "@/models/Subject";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";

const CreateLineBody = z.object({
  storeProductId: z.string().min(1),
  subjectId: z.string().optional().nullable(),
  required: z.boolean().optional(),
  quantity: z.number().int().min(1).max(999).optional(),
  sortOrder: z.number().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

function serializeLine(
  line: {
    _id: mongoose.Types.ObjectId;
    storeProductId: mongoose.Types.ObjectId;
    subjectId?: mongoose.Types.ObjectId | null;
    required: boolean;
    quantity: number;
    sortOrder: number;
    notes?: string | null;
  },
  product?: { name: string; priceMinor: number; imageUrl?: string | null } | null,
  subjectName?: string | null
) {
  return {
    id: String(line._id),
    storeProductId: String(line.storeProductId),
    productName: product?.name || "",
    productPriceMinor: product?.priceMinor ?? 0,
    imageUrl: product?.imageUrl || null,
    subjectId: line.subjectId ? String(line.subjectId) : null,
    subjectName: subjectName || null,
    required: line.required,
    quantity: line.quantity,
    sortOrder: line.sortOrder ?? 0,
    notes: line.notes || "",
  };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireFinanceStaff();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    await connectToDatabase();

    const programId = new mongoose.Types.ObjectId(id);
    const program = await SupplyProgram.findOne({ _id: programId, schoolId }).lean();
    if (!program) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const lines = await SupplyProgramLine.find({ programId })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    const productIds = [...new Set(lines.map((l) => String(l.storeProductId)))];
    const products = await StoreProduct.find({
      _id: { $in: productIds.map((x) => new mongoose.Types.ObjectId(x)) },
      schoolId,
    }).lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const subjIds = lines
      .map((l) => l.subjectId)
      .filter(Boolean) as mongoose.Types.ObjectId[];
    const subjects = await Subject.find({
      _id: { $in: subjIds },
      schoolId,
    })
      .select("name")
      .lean();
    const subjMap = new Map(subjects.map((s) => [String(s._id), s.name]));

    return NextResponse.json({
      success: true,
      data: lines.map((l) =>
        serializeLine(
          l,
          productMap.get(String(l.storeProductId)) || null,
          l.subjectId ? subjMap.get(String(l.subjectId)) ?? null : null
        )
      ),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { success: false, error: "Failed to load lines" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireFinanceStaff();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    await connectToDatabase();

    const programId = new mongoose.Types.ObjectId(id);
    const program = await SupplyProgram.findOne({ _id: programId, schoolId });
    if (!program) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const body = CreateLineBody.parse(await req.json());
    const oid = new mongoose.Types.ObjectId(String(schoolId));

    const product = await StoreProduct.findOne({
      _id: new mongoose.Types.ObjectId(body.storeProductId),
      schoolId: oid,
    });
    if (!product) {
      return NextResponse.json(
        { success: false, error: "Store product not found for this school" },
        { status: 400 }
      );
    }

    let subjectId: mongoose.Types.ObjectId | null = null;
    if (body.subjectId) {
      if (!mongoose.Types.ObjectId.isValid(body.subjectId)) {
        return NextResponse.json(
          { success: false, error: "Invalid subject" },
          { status: 400 }
        );
      }
      const sub = await Subject.findOne({
        _id: new mongoose.Types.ObjectId(body.subjectId),
        schoolId: oid,
      }).select("_id");
      if (!sub) {
        return NextResponse.json(
          { success: false, error: "Subject not found for this school" },
          { status: 400 }
        );
      }
      subjectId = sub._id as mongoose.Types.ObjectId;
    }

    const line = await SupplyProgramLine.create({
      programId,
      storeProductId: product._id,
      subjectId,
      required: body.required ?? true,
      quantity: body.quantity ?? 1,
      sortOrder: body.sortOrder ?? 0,
      notes: body.notes?.trim() || null,
    });

    return NextResponse.json({
      success: true,
      data: { id: String(line._id) },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to add line";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
