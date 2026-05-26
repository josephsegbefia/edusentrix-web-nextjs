import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ paymentIntentId: string }> }
) {
  try {
    const { paymentIntentId } = await ctx.params;
    if (!Types.ObjectId.isValid(paymentIntentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid payment id." },
        { status: 400 }
      );
    }

    const parent = await requireParent();
    await connectToDatabase();

    const payment = await LearnPaymentIntent.findOne({
      _id: new Types.ObjectId(paymentIntentId),
      parentUserId: parent.userId,
      schoolId: parent.schoolId,
    })
      .select(
        "_id schoolId studentId accountId accessId amountMinor currency status paystackReference createdAt succeededAt failureReason"
      )
      .lean();

    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Learn payment not found." },
        { status: 404 }
      );
    }

    await verifyGuardianAccess(parent.userId, String(payment.studentId));

    return NextResponse.json({
      success: true,
      data: {
        id: String(payment._id),
        studentId: String(payment.studentId),
        accountId: payment.accountId ? String(payment.accountId) : null,
        accessId: payment.accessId ? String(payment.accessId) : null,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        status: payment.status,
        paystackReference: payment.paystackReference || null,
        failureReason: payment.failureReason || null,
        createdAt: payment.createdAt?.toISOString?.() || null,
        succeededAt: payment.succeededAt?.toISOString?.() || null,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[parent/learn/payments/[paymentIntentId]:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn payment." },
      { status: 500 }
    );
  }
}
