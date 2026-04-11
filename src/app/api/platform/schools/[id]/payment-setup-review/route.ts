import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { recordActivity } from "@/lib/audit/recordActivity";
import {
  getPaymentSetupNotificationRecipients,
  sendPaymentSetupNotification,
} from "@/lib/school-payments/payment-setup-notifications";
import { School } from "@/models/School";

const ReviewActionSchema = z
  .object({
    action: z.enum(["approve", "send_back"]),
    note: z.string().trim().max(240).nullable().optional().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.action === "send_back" && (!value.note || value.note.trim().length < 8)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "Add a short reason before sending this payout setup back.",
      });
    }
  });

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const body = ReviewActionSchema.parse(await req.json());
    const schoolId = new mongoose.Types.ObjectId(id);

    await connectToDatabase();
    const school = await School.findById(schoolId).select("name billing bank");

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found." },
        { status: 404 }
      );
    }

    if (school.billing?.paymentSetup?.status !== "review_required") {
      return NextResponse.json(
        {
          success: false,
          error: "This payout setup is not currently awaiting manual review.",
        },
        { status: 409 }
      );
    }

    const now = new Date();
    const note = body.note?.trim() || null;
    const billing = school.billing || (school.billing = {});
    const existingPaymentSetup = billing.paymentSetup || {};
    const existingPaystack = billing.paystack || {};

    if (body.action === "approve") {
      billing.status = "unprovisioned";
      billing.paymentSetup = {
        ...existingPaymentSetup,
        status: "details_submitted",
        approvedAt: now,
        approvedBy: gate.me._id,
        approvedByEmail:
          "email" in gate.me && typeof gate.me.email === "string"
            ? gate.me.email
            : null,
        reviewReason: null,
        lastUpdatedAt: now,
        lastUpdatedBy: gate.me._id,
      };
      billing.paystack = {
        ...existingPaystack,
        lastError: null,
      };

      await school.save();

      await sendPaymentSetupNotification({
        recipients: getPaymentSetupNotificationRecipients({
          ownerEmail: school.billing?.paymentSetup?.ownerEmail || null,
          delegateEmail: school.billing?.paymentSetup?.delegateEmail || null,
        }),
        schoolName: school.name || "Your school",
        schoolId: String(schoolId),
        subject: "Payment setup approved for continuation",
        title: "Payment setup review approved",
        message:
          "Your payout setup passed manual review. You can now return to Payment Setup and continue the online payments activation flow.",
        note,
        templateKey: "PAYMENT_SETUP_SUCCESS",
      });

      await recordActivity({
        schoolId,
        userId: gate.me._id,
        type: "payout.approved",
        entityType: "school_payment_setup",
        entityId: schoolId,
        description: `Approved payout setup review for ${school.name || "school"}`,
        metadata: {
          action: "approve",
          note,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          status: "details_submitted",
          reviewReason: null,
          message: "Payout setup approved. The school can now continue setup submission.",
        },
      });
    }

    billing.status = "failed";
    billing.paymentSetup = {
      ...existingPaymentSetup,
      status: "failed",
      approvedAt: null,
      approvedBy: null,
      approvedByEmail: null,
      reviewReason: null,
      lastUpdatedAt: now,
      lastUpdatedBy: gate.me._id,
    };
    billing.paystack = {
      ...existingPaystack,
      lastError:
        note ||
        "Payout setup was sent back after manual review. Please update the bank details and try again.",
    };

    await school.save();

    await sendPaymentSetupNotification({
      recipients: getPaymentSetupNotificationRecipients({
        ownerEmail: school.billing?.paymentSetup?.ownerEmail || null,
        delegateEmail: school.billing?.paymentSetup?.delegateEmail || null,
      }),
      schoolName: school.name || "Your school",
      schoolId: String(schoolId),
      subject: "Payment setup needs attention",
      title: "Payment setup sent back",
      message:
        "The payout setup was sent back after manual review. Update the payout details and try again once the issue has been corrected.",
      note,
      templateKey: "PAYMENT_SETUP_FAILURE",
    });

    await recordActivity({
      schoolId,
      userId: gate.me._id,
      type: "payout.rejected",
      entityType: "school_payment_setup",
      entityId: schoolId,
      description: `Sent payout setup back for ${school.name || "school"}`,
      metadata: {
        action: "send_back",
        note,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        status: "failed",
        reviewReason: null,
        message: "Payout setup sent back to the school for correction.",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.issues[0]?.message || "Invalid review payload.",
        },
        { status: 400 }
      );
    }

    console.error("Failed to review school payment setup:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to review school payment setup",
      },
      { status: 500 }
    );
  }
}
