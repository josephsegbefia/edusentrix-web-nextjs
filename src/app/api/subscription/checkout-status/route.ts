import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { SubscriptionCheckoutIntent } from "@/models/SubscriptionCheckoutIntent";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const reference = req.nextUrl.searchParams.get("reference")?.trim();

    if (!reference) {
      return NextResponse.json(
        { success: false, error: "Missing checkout reference." },
        { status: 400 }
      );
    }

    const checkout = await SubscriptionCheckoutIntent.findOne({
      schoolId: new mongoose.Types.ObjectId(String(schoolId)),
      paystackReference: reference,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!checkout) {
      return NextResponse.json(
        { success: false, error: "Subscription checkout not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(checkout._id),
        status: checkout.status,
        tierName: checkout.targetTierName,
        amountMinor: checkout.amountMinor,
        failureReason: checkout.failureReason || null,
        appliedAt: checkout.appliedAt?.toISOString?.() || null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to load subscription checkout status:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load subscription checkout status",
      },
      { status: 500 }
    );
  }
}
