import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePaymentSetupAccess } from "@/lib/auth/requirePaymentSetupAccess";
import { recordActivity } from "@/lib/audit/recordActivity";
import { clearPaymentSetupDelegate } from "@/lib/school-payments/billing-owner-lifecycle";

export async function DELETE() {
  try {
    const access = await requirePaymentSetupAccess();
    if (!access.capabilities.canManageDelegate) {
      return NextResponse.json(
        {
          success: false,
          error: "Only the billing owner can remove a finance delegate.",
        },
        { status: 403 }
      );
    }

    await clearPaymentSetupDelegate({
      schoolId: access.schoolId,
      updatedBy: access.userId,
    });

    await recordActivity({
      schoolId: new mongoose.Types.ObjectId(String(access.schoolId)),
      userId: new mongoose.Types.ObjectId(String(access.userId)),
      type: "invitation.revoked",
      entityType: "school_payment_setup_delegate",
      entityId: String(access.schoolId),
      description: "Cleared finance delegate access from payment setup",
      metadata: {
        accessSurface: "payment_setup_delegate",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        cleared: true,
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to clear finance delegate:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to clear finance delegate",
      },
      { status: 500 }
    );
  }
}
