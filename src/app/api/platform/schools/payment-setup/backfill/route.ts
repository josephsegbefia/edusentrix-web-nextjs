import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { hasCompleteSchoolBankDetails } from "@/lib/school-payments/payment-setup";

const BodySchema = z.object({
  schoolId: z.string().trim().optional(),
});

function inferPaymentSetupStatus(school: {
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
      ownerEmail?: string | null;
      ownerName?: string | null;
      reviewReason?: string | null;
    } | null;
    paystack?: {
      subaccountCode?: string | null;
      subaccountId?: string | null;
      lastError?: string | null;
    } | null;
  } | null;
}) {
  const explicit = school.billing?.paymentSetup?.status;
  const hasPaystackRail = Boolean(
    school.billing?.paystack?.subaccountCode || school.billing?.paystack?.subaccountId
  );
  const hasOwnerSignal = Boolean(
    school.billing?.paymentSetup?.ownerEmail || school.billing?.paymentSetup?.ownerName
  );
  const hasBankDetails = hasCompleteSchoolBankDetails(school);

  if (hasPaystackRail) {
    return {
      paymentSetupStatus: "provisioned" as const,
      billingStatus: "provisioned" as const,
      reviewReason: null,
    };
  }

  if (explicit === "review_required") {
    return {
      paymentSetupStatus: "review_required" as const,
      billingStatus: "unprovisioned" as const,
      reviewReason:
        school.billing?.paymentSetup?.reviewReason ||
        "This payout setup requires manual review before it can go live.",
    };
  }

  if (explicit === "pending_provisioning") {
    return {
      paymentSetupStatus: "pending_provisioning" as const,
      billingStatus: "unprovisioned" as const,
      reviewReason: null,
    };
  }

  if (school.billing?.status === "failed" || school.billing?.paystack?.lastError) {
    return {
      paymentSetupStatus: "failed" as const,
      billingStatus: "failed" as const,
      reviewReason: null,
    };
  }

  if (hasBankDetails) {
    return {
      paymentSetupStatus: "details_submitted" as const,
      billingStatus: "unprovisioned" as const,
      reviewReason: null,
    };
  }

  if (hasOwnerSignal) {
    return {
      paymentSetupStatus: "awaiting_billing_owner" as const,
      billingStatus: "unprovisioned" as const,
      reviewReason: null,
    };
  }

  return {
    paymentSetupStatus: "not_started" as const,
    billingStatus: "unprovisioned" as const,
    reviewReason: null,
  };
}

export async function POST(req: NextRequest) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.res;

  try {
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    await connectToDatabase();

    const filter =
      parsed.schoolId && mongoose.Types.ObjectId.isValid(parsed.schoolId)
        ? { _id: new mongoose.Types.ObjectId(parsed.schoolId) }
        : {};

    const schools = await School.find(filter)
      .select("name bank billing")
      .lean<
        Array<{
          _id: mongoose.Types.ObjectId;
          name?: string | null;
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
              ownerEmail?: string | null;
              ownerName?: string | null;
              reviewReason?: string | null;
            } | null;
            paystack?: {
              subaccountCode?: string | null;
              subaccountId?: string | null;
              lastError?: string | null;
            } | null;
          } | null;
        }>
      >();

    const results = await Promise.all(
      schools.map(async (school) => {
        const next = inferPaymentSetupStatus(school);
        const prevStatus = school.billing?.paymentSetup?.status || "not_started";
        const prevBilling = school.billing?.status || "unprovisioned";
        const changed =
          prevStatus !== next.paymentSetupStatus || prevBilling !== next.billingStatus;

        if (changed) {
          await School.updateOne(
            { _id: school._id },
            {
              $set: {
                "billing.status": next.billingStatus,
                "billing.paymentSetup.status": next.paymentSetupStatus,
                "billing.paymentSetup.reviewReason": next.reviewReason,
              },
            }
          );
        }

        return {
          schoolId: String(school._id),
          schoolName: school.name || "Unnamed School",
          previousStatus: prevStatus,
          nextStatus: next.paymentSetupStatus,
          changed,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        total: results.length,
        changed: results.filter((row) => row.changed).length,
        unchanged: results.filter((row) => !row.changed).length,
        schools: results,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.issues[0]?.message || "Invalid backfill request.",
        },
        { status: 400 }
      );
    }

    console.error("Failed to backfill payment setup states:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to backfill payment setup states",
      },
      { status: 500 }
    );
  }
}
