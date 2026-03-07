import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionTier } from "@/models/SubscriptionTier";

export async function GET() {
  try {
    await connectToDatabase();

    const tiers = await SubscriptionTier.find({ active: true })
      .select("code name description priceMinor studentLimit features provisional sortOrder")
      .sort({ sortOrder: 1, priceMinor: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        tiers: tiers.map((tier) => ({
          id: String(tier._id),
          code: tier.code,
          name: tier.name,
          description: tier.description || null,
          priceMinor: tier.priceMinor,
          studentLimit: tier.studentLimit ?? null,
          features: Array.isArray(tier.features) ? tier.features : [],
          provisional: Boolean(tier.provisional),
        })),
      },
    });
  } catch (error) {
    console.error("Failed to load public pricing:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load pricing",
      },
      { status: 500 }
    );
  }
}
