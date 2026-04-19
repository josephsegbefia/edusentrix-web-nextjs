import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { StoreProduct } from "@/models/StoreProduct";

export async function GET() {
  try {
    const ctx = await requireParent();
    await connectToDatabase();

    const products = await StoreProduct.find({
      schoolId: ctx.schoolId,
      isActive: true,
    })
      .sort({ sortOrder: 1, name: 1 })
      .select("_id name description priceMinor currency imageUrl")
      .lean();

    return NextResponse.json({
      success: true,
      data: products.map((p) => ({
        id: String(p._id),
        name: p.name,
        description: p.description || "",
        priceMinor: p.priceMinor,
        currency: p.currency || "GHS",
        imageUrl: p.imageUrl || null,
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
