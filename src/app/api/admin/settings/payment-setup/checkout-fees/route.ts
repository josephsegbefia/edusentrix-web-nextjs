import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePaymentSetupAccess } from "@/lib/auth/requirePaymentSetupAccess";
import { connectToDatabase } from "@/db/connectToDatabase";
import { resolveSchoolFeeCheckoutCharge } from "@/lib/fees/school-fee-checkout-charges";
import { School } from "@/models/School";

const UpdateCheckoutFeesSchema = z.object({
  schoolFeePayerMode: z.enum([
    "platform_default",
    "payer_pays",
    "school_absorbs",
  ]),
});

type CheckoutFeeSchoolRow = {
  billing?: {
    checkoutFees?: {
      schoolFeePayerMode?: "platform_default" | "payer_pays" | "school_absorbs" | null;
      updatedAt?: Date | null;
    } | null;
  } | null;
};

export async function GET() {
  try {
    const access = await requirePaymentSetupAccess();
    await connectToDatabase();

    const school = await School.findById(access.schoolId)
      .select("billing.checkoutFees")
      .lean<CheckoutFeeSchoolRow | null>();

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    const preference =
      school.billing?.checkoutFees?.schoolFeePayerMode || "platform_default";
    const preview = await resolveSchoolFeeCheckoutCharge({
      schoolId: access.schoolId,
      amountMinor: 10000,
      payerModePreference: preference,
    });

    return NextResponse.json({
      success: true,
      data: {
        schoolFeePayerMode: preference,
        effectivePayerMode: preview.payerMode,
        policyPayerMode: preview.policyPayerMode,
        example: {
          invoiceAmountMinor: preview.invoiceAmountMinor,
          parentPayableMinor: preview.parentPayableMinor,
          platformFeeMinor: preview.platformFeeMinor,
          estimatedSchoolNetMinor: preview.estimatedSchoolNetMinor,
        },
        updatedAt: school.billing?.checkoutFees?.updatedAt?.toISOString?.() || null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to load checkout fee settings:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load checkout fee settings",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requirePaymentSetupAccess();
    if (!access.capabilities.canManage) {
      return NextResponse.json(
        {
          success: false,
          error: "Only the billing owner or finance delegate can manage checkout fee settings.",
        },
        { status: 403 }
      );
    }

    const body = UpdateCheckoutFeesSchema.parse(await req.json());
    await connectToDatabase();

    const updated = await School.findByIdAndUpdate(
      access.schoolId,
      {
        $set: {
          "billing.checkoutFees.schoolFeePayerMode": body.schoolFeePayerMode,
          "billing.checkoutFees.updatedAt": new Date(),
          "billing.checkoutFees.updatedBy": access.userId,
        },
      },
      { new: true }
    )
      .select("billing.checkoutFees")
      .lean<CheckoutFeeSchoolRow | null>();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    const preference =
      updated.billing?.checkoutFees?.schoolFeePayerMode || "platform_default";
    const preview = await resolveSchoolFeeCheckoutCharge({
      schoolId: access.schoolId,
      amountMinor: 10000,
      payerModePreference: preference,
    });

    return NextResponse.json({
      success: true,
      data: {
        schoolFeePayerMode: preference,
        effectivePayerMode: preview.payerMode,
        policyPayerMode: preview.policyPayerMode,
        example: {
          invoiceAmountMinor: preview.invoiceAmountMinor,
          parentPayableMinor: preview.parentPayableMinor,
          platformFeeMinor: preview.platformFeeMinor,
          estimatedSchoolNetMinor: preview.estimatedSchoolNetMinor,
        },
        updatedAt: updated.billing?.checkoutFees?.updatedAt?.toISOString?.() || null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Invalid checkout fee setting" },
        { status: 400 }
      );
    }

    console.error("Failed to update checkout fee settings:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update checkout fee settings",
      },
      { status: 500 }
    );
  }
}
