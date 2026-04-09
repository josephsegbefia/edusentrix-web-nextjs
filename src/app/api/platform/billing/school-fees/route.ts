import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import {
  getTransactionFeeConfig,
  resolveTransactionFeeConfigForSchool,
} from "@/lib/billing/transaction-fees";
import { School } from "@/models/School";
import { isSchoolPaymentReady } from "@/lib/school-payments/payment-setup";

type SchoolFeeRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  status?: string;
  createdBy?: mongoose.Types.ObjectId | null;
  bank?: {
    bankName?: string | null;
    branchName?: string | null;
    sortCode?: string | null;
    accountName?: string | null;
    accountNumber?: string | null;
  } | null;
  billing?: {
    status?: "unprovisioned" | "provisioned" | "failed" | null;
    paymentSetup?: {
      status?:
        | "not_started"
        | "awaiting_billing_owner"
        | "details_submitted"
        | "pending_provisioning"
        | "review_required"
        | "provisioned"
        | "failed"
        | null;
      ownerUserId?: mongoose.Types.ObjectId | null;
      ownerName?: string | null;
      ownerEmail?: string | null;
    } | null;
    paystack?: {
      subaccountCode?: string | null;
      subaccountId?: string | null;
      lastError?: string | null;
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
        "name status createdBy bank billing.status billing.paymentSetup billing.paystack.subaccountCode billing.paystack.subaccountId billing.paystack.lastError billing.transactionFees.mode billing.transactionFees.percent billing.transactionFees.capMinor billing.transactionFees.notes billing.transactionFees.updatedAt"
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
            paymentReady: isSchoolPaymentReady(school),
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
