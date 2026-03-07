import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Guardian } from "@/models/Guardian";
import { Payment } from "@/models/Payment";
import { PaymentIntent } from "@/models/PaymentIntent";

type GuardLink = {
  studentId: mongoose.Types.ObjectId;
};

type PaymentRow = {
  _id: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  amountMinor?: number;
  paymentDate?: Date;
  status?: string;
};

type PaymentIntentRow = {
  _id: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  amountMinor?: number;
  status?: string;
  failureReason?: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const reference = req.nextUrl.searchParams.get("reference")?.trim();
    if (!reference) {
      return NextResponse.json(
        { success: false, error: "Missing reference" },
        { status: 400 }
      );
    }

    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId")
      .lean<GuardLink[]>();
    const studentIds = guardians.map((g) => g.studentId);

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          status: "not_found",
          message: "No wards linked to this account.",
        },
      });
    }

    const payment = await Payment.findOne({
      schoolId: context.schoolId,
      studentId: { $in: studentIds },
      paystackReference: reference,
      status: { $nin: ["failed", "reversed"] },
    })
      .select("_id invoiceId amountMinor paymentDate status")
      .lean<PaymentRow | null>();

    if (payment) {
      return NextResponse.json({
        success: true,
        data: {
          status: "completed",
          paymentId: String(payment._id),
          invoiceId: String(payment.invoiceId),
          amountMinor: Number(payment.amountMinor || 0),
          paymentDate: payment.paymentDate?.toISOString() || null,
          message: "Payment confirmed.",
        },
      });
    }

    const paymentIntent = await PaymentIntent.findOne({
      schoolId: context.schoolId,
      studentId: { $in: studentIds },
      paystackReference: reference,
    })
      .select("_id invoiceId amountMinor status failureReason")
      .lean<PaymentIntentRow | null>();

    if (!paymentIntent) {
      return NextResponse.json({
        success: true,
        data: {
          status: "not_found",
          message: "We have not received confirmation for this payment yet.",
        },
      });
    }

    const mappedStatus =
      paymentIntent.status === "succeeded"
        ? "completed"
        : paymentIntent.status === "failed" ||
            paymentIntent.status === "cancelled" ||
            paymentIntent.status === "expired"
          ? "failed"
          : "pending";

    return NextResponse.json({
      success: true,
      data: {
        status: mappedStatus,
        paymentIntentId: String(paymentIntent._id),
        invoiceId: String(paymentIntent.invoiceId),
        amountMinor: Number(paymentIntent.amountMinor || 0),
        message:
          mappedStatus === "failed"
            ? paymentIntent.failureReason || "This checkout did not complete."
            : mappedStatus === "completed"
              ? "Payment confirmed."
              : "Your payment is being verified.",
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch parent checkout status:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch checkout status",
      },
      { status: 500 }
    );
  }
}
