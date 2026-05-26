import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import {
  fulfillLearnPaymentSuccess,
  learnVerificationMatchesIntent,
  markLearnPaymentFailed,
} from "@/lib/learn/fulfill-learn-payment";
import { verifyTransaction } from "@/lib/paystack";
import { Guardian } from "@/models/Guardian";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";

type IntentRow = {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  parentUserId: Types.ObjectId;
  accountId?: Types.ObjectId | null;
  accessId?: Types.ObjectId | null;
  amountMinor: number;
  status: string;
  failureReason?: string | null;
};

type AccessRow = {
  expiresAt: Date;
};

export async function GET(req: NextRequest) {
  try {
    const parent = await requireParent();
    await connectToDatabase();

    const reference = req.nextUrl.searchParams.get("reference")?.trim();
    if (!reference) {
      return NextResponse.json(
        { success: false, error: "Missing payment reference." },
        { status: 400 }
      );
    }

    const guardians = await Guardian.find({ userId: parent.userId })
      .select("studentId")
      .lean<{ studentId: Types.ObjectId }[]>();
    const studentIds = guardians.map((guardian) => guardian.studentId);

    if (!studentIds.length) {
      return NextResponse.json({
        success: true,
        data: {
          status: "not_found",
          message: "No wards linked to this account.",
        },
      });
    }

    const paymentIntent = await LearnPaymentIntent.findOne({
      schoolId: parent.schoolId,
      parentUserId: parent.userId,
      studentId: { $in: studentIds },
      paystackReference: reference,
    })
      .select(
        "_id schoolId studentId parentUserId accountId accessId amountMinor status failureReason"
      )
      .lean<IntentRow | null>();

    if (!paymentIntent) {
      return NextResponse.json({
        success: true,
        data: {
          status: "not_found",
          message: "We have not received confirmation for this Learn payment yet.",
        },
      });
    }

    if (paymentIntent.status === "succeeded" && paymentIntent.accessId) {
      const access = await LearnAccess.findById(paymentIntent.accessId)
        .select("expiresAt")
        .lean<AccessRow | null>();

      return NextResponse.json({
        success: true,
        data: {
          status: "completed",
          paymentIntentId: String(paymentIntent._id),
          studentId: String(paymentIntent.studentId),
          accessId: String(paymentIntent.accessId),
          expiresAt: access?.expiresAt?.toISOString?.() || null,
          message: "Learn access is active.",
        },
      });
    }

    if (
      paymentIntent.status === "failed" ||
      paymentIntent.status === "cancelled" ||
      paymentIntent.status === "expired"
    ) {
      return NextResponse.json({
        success: true,
        data: {
          status: "failed",
          paymentIntentId: String(paymentIntent._id),
          studentId: String(paymentIntent.studentId),
          message:
            paymentIntent.failureReason || "This Learn checkout did not complete.",
        },
      });
    }

    let fallbackMessage =
      "Your Learn payment is being verified. Please check again shortly.";

    if (
      paymentIntent.status === "awaiting_webhook" ||
      paymentIntent.status === "initiated"
    ) {
      try {
        const verification = await verifyTransaction(reference);
        const paystackStatus = String(verification.status || "").toLowerCase();

        if (paystackStatus === "success") {
          if (!learnVerificationMatchesIntent({ verification, intent: paymentIntent })) {
            return NextResponse.json({
              success: true,
              data: {
                status: "pending",
                paymentIntentId: String(paymentIntent._id),
                studentId: String(paymentIntent.studentId),
                message:
                  "Paystack reports this payment as successful, but its details need review before Learn access can activate.",
              },
            });
          }

          const outcome = await fulfillLearnPaymentSuccess({
            reference,
            verification,
            actorType: "verify",
          });

          if (!outcome.ok || !outcome.accessId) {
            return NextResponse.json({
              success: true,
              data: {
                status: "pending",
                paymentIntentId: String(paymentIntent._id),
                studentId: String(paymentIntent.studentId),
                message: outcome.message,
              },
            });
          }

          const access = await LearnAccess.findById(outcome.accessId)
            .select("expiresAt")
            .lean<AccessRow | null>();

          return NextResponse.json({
            success: true,
            data: {
              status: "completed",
              paymentIntentId: String(paymentIntent._id),
              studentId: String(paymentIntent.studentId),
              accessId: outcome.accessId,
              expiresAt: access?.expiresAt?.toISOString?.() || null,
              message: outcome.message,
            },
          });
        }

        if (paystackStatus === "failed" || paystackStatus === "abandoned") {
          await markLearnPaymentFailed({
            paymentIntentId: paymentIntent._id,
            reference,
            failureReason:
              paystackStatus === "abandoned"
                ? "Checkout was abandoned before payment completed."
                : "Paystack reported that this Learn payment did not complete.",
            verification,
          });

          return NextResponse.json({
            success: true,
            data: {
              status: "failed",
              paymentIntentId: String(paymentIntent._id),
              studentId: String(paymentIntent.studentId),
              message: "This Learn checkout did not complete.",
            },
          });
        }

        fallbackMessage =
          "Paystack is still processing this payment. Please wait a moment and refresh.";
      } catch (verificationError) {
        console.error("[parent/learn/payments/verify:GET]", verificationError);
        fallbackMessage =
          "We could not verify this Learn payment with Paystack yet. Please try again shortly.";
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        status: "pending",
        paymentIntentId: String(paymentIntent._id),
        studentId: String(paymentIntent.studentId),
        message: fallbackMessage,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[parent/learn/payments/verify:GET]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to verify Learn payment.",
      },
      { status: 500 }
    );
  }
}
