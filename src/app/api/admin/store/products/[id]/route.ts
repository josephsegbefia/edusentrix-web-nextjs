import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { StoreProduct } from "@/models/StoreProduct";

const PatchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  priceMinor: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const body = PatchBody.parse(await req.json());
    const $set: Record<string, unknown> = {};
    if (body.name !== undefined) $set.name = body.name.trim();
    if (body.description !== undefined) $set.description = body.description;
    if (body.priceMinor !== undefined) $set.priceMinor = body.priceMinor;
    if (body.imageUrl !== undefined) $set.imageUrl = body.imageUrl;
    if (body.isActive !== undefined) $set.isActive = body.isActive;
    if (body.sortOrder !== undefined) $set.sortOrder = body.sortOrder;

    const res = await StoreProduct.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), schoolId },
      { $set },
      { new: true }
    );

    if (!res) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
