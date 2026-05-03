// src/app/api/public/admissions/applications/[token]/pay/init/route.ts
// PUBLIC endpoint. Initialises a Paystack transaction for the application's
// fee, identified solely by the unguessable tracker token. The caller does
// not need to be authenticated — anyone holding the tracker link can pay.
//
// Idempotency: when feeStatus is already "paid" or "waived" we short-circuit
// with 409. When a previous init exists but is still pending, we re-use the
// reference (Paystack handles re-authorization for us if the access code has
// expired by returning a fresh URL on init).

import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { School } from "@/models/School";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import {
  buildAdmissionsFeeMetadata,
  buildAdmissionsFeeReference,
} from "@/lib/admissions/fee-payments";
import { initializeTransaction } from "@/lib/paystack";
import { assertParentCheckoutAllowed } from "@/lib/internal-test/assert-parent-checkout-allowed";

type Params = Promise<{ token: string }>;

function pickOrigin(req: NextRequest): string {
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envOrigin) return envOrigin.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json(
        { success: false, error: "Invalid tracker link" },
        { status: 404 }
      );
    }

    await connectToDatabase();

    const application = await AdmissionApplication.findOne({
      "tracker.token": token,
    });
    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    if (application.feeStatus === "paid") {
      return NextResponse.json(
        { success: false, error: "Fee already paid" },
        { status: 409 }
      );
    }
    if (application.feeStatus === "waived") {
      return NextResponse.json(
        { success: false, error: "Fee was waived" },
        { status: 409 }
      );
    }
    if (application.feeStatus === "not_required") {
      return NextResponse.json(
        { success: false, error: "No fee required for this application" },
        { status: 409 }
      );
    }

    const [cycle, school] = await Promise.all([
      AdmissionCycle.findById(application.cycleId)
        .select({ applicationFee: 1, name: 1, slug: 1 })
        .lean(),
      School.findById(application.schoolId)
        .select({ name: 1, "billing.paystack": 1 })
        .lean(),
    ]);

    const schoolOid =
      application.schoolId instanceof mongoose.Types.ObjectId
        ? application.schoolId
        : new mongoose.Types.ObjectId(String(application.schoolId));
    const admissionsBlocked = await assertParentCheckoutAllowed(schoolOid);
    if (admissionsBlocked) return admissionsBlocked;

    if (!cycle?.applicationFee?.enabled) {
      return NextResponse.json(
        { success: false, error: "This cycle does not collect a fee" },
        { status: 400 }
      );
    }
    if (cycle.applicationFee.mode !== "online_paystack") {
      return NextResponse.json(
        {
          success: false,
          error:
            "This cycle accepts manual payment only. Please follow the instructions on your tracker.",
        },
        { status: 400 }
      );
    }

    const amountMinor = cycle.applicationFee.amountMinor;
    const currency = cycle.applicationFee.currency || "GHS";
    if (!amountMinor || amountMinor <= 0) {
      return NextResponse.json(
        { success: false, error: "Application fee amount is not configured" },
        { status: 400 }
      );
    }

    const reference =
      application.feePayment?.reference ??
      buildAdmissionsFeeReference(application._id);

    application.feeStatus = "pending";
    application.feePayment = {
      reference,
      amountMinor,
      currency,
      initiatedAt: application.feePayment?.initiatedAt ?? new Date(),
      paidAt: application.feePayment?.paidAt ?? null,
      failedAt: null,
      channel: application.feePayment?.channel ?? null,
      paystackMeta: application.feePayment?.paystackMeta ?? null,
    };
    await application.save();

    const metadata = buildAdmissionsFeeMetadata({
      applicationId: String(application._id),
      cycleId: String(application.cycleId),
      schoolId: String(application.schoolId),
      referenceCode: application.referenceCode,
    });

    const origin = pickOrigin(req);
    const callbackUrl = `${origin}/apply/track/${token}?fee=processing`;

    const subaccountCode =
      (school?.billing as { paystack?: { subaccountCode?: string | null } } | undefined)
        ?.paystack?.subaccountCode ?? null;

    const init = await initializeTransaction({
      email: application.guardian.email,
      amountMinor,
      reference,
      currency,
      callbackUrl,
      metadata,
      subaccountCode: subaccountCode || undefined,
    });

    await AdmissionEvent.create({
      schoolId: application.schoolId,
      cycleId: application.cycleId,
      applicationId: application._id,
      actor: { label: "Applicant", role: "applicant" },
      kind: "application.fee_initiated",
      metadata: {
        reference,
        amountMinor,
        currency,
        callbackUrl,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl: init.authorization_url,
        reference: init.reference ?? reference,
        accessCode: init.access_code,
        amountMinor,
        currency,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Public admissions fee init error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start payment" },
      { status: 500 }
    );
  }
}
