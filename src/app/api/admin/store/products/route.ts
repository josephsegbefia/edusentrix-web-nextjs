import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { StoreProduct } from "@/models/StoreProduct";

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priceMinor: z.number().int().min(0),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export async function GET() {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const products = await StoreProduct.find({ schoolId })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: products.map((p) => ({
        id: String(p._id),
        name: p.name,
        description: p.description || "",
        priceMinor: p.priceMinor,
        currency: p.currency || "GHS",
        isActive: p.isActive,
        sortOrder: p.sortOrder ?? 0,
        imageUrl: p.imageUrl || null,
        updatedAt: p.updatedAt?.toISOString() || null,
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { success: false, error: "Failed to load products" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const body = CreateBody.parse(await req.json());

    const doc = await StoreProduct.create({
      schoolId: new mongoose.Types.ObjectId(String(schoolId)),
      name: body.name.trim(),
      description: body.description?.trim() || null,
      priceMinor: body.priceMinor,
      currency: "GHS",
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
      imageUrl: body.imageUrl || null,
    });

    return NextResponse.json({
      success: true,
      data: { id: String(doc._id) },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Failed to create product";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
