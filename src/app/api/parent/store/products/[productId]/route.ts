import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { StoreProduct } from "@/models/StoreProduct";

type Params = Promise<{ productId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  try {
    const ctx = await requireParent();
    const { productId } = await params;
    await connectToDatabase();
    const product = await StoreProduct.findOne({
      _id: productId,
      schoolId: ctx.schoolId,
      isActive: true,
    }).lean();
    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: {
        id: String(product._id),
        name: product.name,
        description: product.description || null,
        longDescription: product.description || null,
        price: (product.priceMinor || 0) / 100,
        imageUrl: product.imageUrl || null,
        category: null,
        gradeLevel: null,
        inStock: true,
        sizes: [],
        variants: [],
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load product";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
