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

    const mapped = products.map((p) => ({
        id: String(p._id),
        name: p.name,
        description: p.description || null,
        price: (p.priceMinor || 0) / 100,
        priceMinor: p.priceMinor,
        currency: p.currency || "GHS",
        imageUrl: p.imageUrl || null,
        category: null,
        gradeLevel: null,
        inStock: true,
      }));

    return NextResponse.json({
      success: true,
      data: {
        products: mapped,
        categories: [],
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { success: false, error: "Failed to load products" },
      { status: 500 }
    );
  }
}
