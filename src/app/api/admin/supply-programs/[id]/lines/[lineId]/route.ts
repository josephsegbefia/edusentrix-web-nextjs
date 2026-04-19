import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { StoreProduct } from "@/models/StoreProduct";
import { Subject } from "@/models/Subject";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";

const PatchBody = z.object({
  storeProductId: z.string().min(1).optional(),
  subjectId: z.string().optional().nullable(),
  required: z.boolean().optional(),
  quantity: z.number().int().min(1).max(999).optional(),
  sortOrder: z.number().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { schoolId } = await requireFinanceStaff();
    const { id, lineId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(lineId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    await connectToDatabase();

    const programId = new mongoose.Types.ObjectId(id);
    const program = await SupplyProgram.findOne({ _id: programId, schoolId });
    if (!program) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const line = await SupplyProgramLine.findOne({
      _id: new mongoose.Types.ObjectId(lineId),
      programId,
    });
    if (!line) {
      return NextResponse.json({ success: false, error: "Line not found" }, { status: 404 });
    }

    const body = PatchBody.parse(await req.json());
    const oid = new mongoose.Types.ObjectId(String(schoolId));

    if (body.storeProductId !== undefined) {
      const product = await StoreProduct.findOne({
        _id: new mongoose.Types.ObjectId(body.storeProductId),
        schoolId: oid,
      });
      if (!product) {
        return NextResponse.json(
          { success: false, error: "Store product not found" },
          { status: 400 }
        );
      }
      line.storeProductId = product._id as mongoose.Types.ObjectId;
    }

    if (body.subjectId !== undefined) {
      if (!body.subjectId) {
        line.subjectId = null;
      } else {
        const sub = await Subject.findOne({
          _id: new mongoose.Types.ObjectId(body.subjectId),
          schoolId: oid,
        }).select("_id");
        if (!sub) {
          return NextResponse.json(
            { success: false, error: "Subject not found" },
            { status: 400 }
          );
        }
        line.subjectId = sub._id as mongoose.Types.ObjectId;
      }
    }

    if (body.required !== undefined) line.required = body.required;
    if (body.quantity !== undefined) line.quantity = body.quantity;
    if (body.sortOrder !== undefined) line.sortOrder = body.sortOrder;
    if (body.notes !== undefined) line.notes = body.notes?.trim() || null;

    await line.save();

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to update line";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { schoolId } = await requireFinanceStaff();
    const { id, lineId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(lineId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    await connectToDatabase();

    const programId = new mongoose.Types.ObjectId(id);
    const program = await SupplyProgram.findOne({ _id: programId, schoolId });
    if (!program) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const res = await SupplyProgramLine.deleteOne({
      _id: new mongoose.Types.ObjectId(lineId),
      programId,
    });
    if (res.deletedCount === 0) {
      return NextResponse.json({ success: false, error: "Line not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { success: false, error: "Failed to delete line" },
      { status: 500 }
    );
  }
}
