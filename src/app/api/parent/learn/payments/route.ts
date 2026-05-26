import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, getParentWardIds } from "@/lib/auth/requireParent";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";

export async function GET() {
  try {
    const ctx = await requireParent();
    await connectToDatabase();

    const wardIds = await getParentWardIds(ctx.userId);
    const payments = await LearnPaymentIntent.find({
      parentUserId: ctx.userId,
      schoolId: ctx.schoolId,
      studentId: { $in: wardIds },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("_id studentId amountMinor currency status paystackReference createdAt succeededAt")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        payments: payments.map((payment) => ({
          id: String(payment._id),
          studentId: String(payment.studentId),
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          status: payment.status,
          paystackReference: payment.paystackReference || null,
          createdAt: payment.createdAt?.toISOString?.() || null,
          succeededAt: payment.succeededAt?.toISOString?.() || null,
        })),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[parent/learn/payments:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn payments." },
      { status: 500 }
    );
  }
}
