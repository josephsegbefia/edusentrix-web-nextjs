import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import {
  getTransactionFeeConfig,
  resolveTransactionFeeConfigForSchool,
} from "@/lib/billing/transaction-fees";
import { School } from "@/models/School";

type SchoolFeeRow = {
  _id: { toString(): string };
  name?: string;
  status?: string;
  billing?: {
    paystack?: {
      subaccountCode?: string | null;
    };
    transactionFees?: {
      mode?: "platform_default" | "custom" | "disabled" | null;
      percent?: number | null;
      capMinor?: number | null;
      notes?: string | null;
      updatedAt?: Date | null;
    };
  };
};

export async function GET() {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const platformDefault = getTransactionFeeConfig();
    const schools = await School.find({})
      .select(
        "name status billing.paystack.subaccountCode billing.transactionFees.mode billing.transactionFees.percent billing.transactionFees.capMinor billing.transactionFees.notes billing.transactionFees.updatedAt"
      )
      .sort({ name: 1 })
      .lean<SchoolFeeRow[]>();

    return NextResponse.json({
      success: true,
      data: {
        platformDefault,
        schools: schools.map((school) => {
          const policy = school.billing?.transactionFees || null;
          const effective = resolveTransactionFeeConfigForSchool(policy);
          return {
            id: String(school._id),
            name: school.name || "Unnamed School",
            status: school.status || "pending",
            paymentReady: Boolean(school.billing?.paystack?.subaccountCode),
            transactionFeePolicy: {
              mode: policy?.mode || "platform_default",
              percent: policy?.percent ?? null,
              capMinor: policy?.capMinor ?? null,
              notes: policy?.notes || null,
              updatedAt: policy?.updatedAt?.toISOString?.() || null,
            },
            effectiveTransactionFee: {
              percent: effective.percent,
              capMinor: effective.capMinor,
            },
          };
        }),
      },
    });
  } catch (error) {
    console.error("Failed to load school transaction fee policies:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load school transaction fee policies",
      },
      { status: 500 }
    );
  }
}
