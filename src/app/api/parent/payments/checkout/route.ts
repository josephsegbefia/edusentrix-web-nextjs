import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import {
  computeTransactionFee,
  resolveTransactionFeeConfigForSchool,
} from "@/lib/billing/transaction-fees";
import { getPaystackKeyMode, initializeTransaction } from "@/lib/paystack";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { Guardian } from "@/models/Guardian";
import { Invoice } from "@/models/Invoice";
import { PaymentIntent } from "@/models/PaymentIntent";
import { School } from "@/models/School";
import { User } from "@/models/User";
import {
  deriveSchoolPaymentSetupStatus,
  isSchoolPaymentReady,
} from "@/lib/school-payments/payment-setup";

const BodySchema = z.object({
  invoiceId: z.string().min(1),
  preview: z.boolean().optional().default(false),
  returnPath: z.string().trim().optional(),
  returnUrl: z.string().trim().optional(),
});

type InvoiceRow = {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  invoiceNumber?: string;
  status?: string;
  totalOutstandingMinor?: number;
};

type SchoolRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
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
    };
  };
};

const PAYABLE_STATUSES = new Set(["issued", "partially_paid", "overdue"]);

function normalizeParentReturnPath(value: string | undefined) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, "http://localhost");
    const pathWithSearch = `${url.pathname}${url.search}`;
    if (url.pathname !== "/parent" && !url.pathname.startsWith("/parent/")) {
      return null;
    }
    return pathWithSearch;
  } catch {
    return null;
  }
}

function normalizeMobileReturnUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const allowedProtocols =
      process.env.NODE_ENV === "production"
        ? new Set(["jedi:"])
        : new Set(["jedi:", "exp:", "exps:"]);

    if (!allowedProtocols.has(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let paymentIntentId: mongoose.Types.ObjectId | null = null;

  try {
    const context = await requireParent();
    await connectToDatabase();

    const body = BodySchema.parse(await req.json());
    if (!mongoose.Types.ObjectId.isValid(body.invoiceId)) {
      return NextResponse.json(
        { success: false, error: "Invalid invoice ID" },
        { status: 400 }
      );
    }

    const invoiceId = new mongoose.Types.ObjectId(body.invoiceId);
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      schoolId: context.schoolId,
    })
      .select("_id schoolId studentId invoiceNumber status totalOutstandingMinor")
      .lean<InvoiceRow | null>();

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    const guardianAccess = await Guardian.findOne({
      userId: context.userId,
      studentId: invoice.studentId,
    })
      .select("_id")
      .lean();

    if (!guardianAccess) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this invoice" },
        { status: 403 }
      );
    }

    if (!PAYABLE_STATUSES.has(String(invoice.status || ""))) {
      return NextResponse.json(
        {
          success: false,
          error: "This invoice is not eligible for online payment",
        },
        { status: 409 }
      );
    }

    const amountMinor = Number(invoice.totalOutstandingMinor || 0);
    if (amountMinor <= 0) {
      return NextResponse.json(
        { success: false, error: "This invoice has no outstanding balance" },
        { status: 409 }
      );
    }

    const school = await School.findById(context.schoolId)
      .select(
        "name bank billing.status billing.paymentSetup billing.paystack.subaccountCode billing.paystack.subaccountId billing.paystack.lastError billing.transactionFees.mode billing.transactionFees.percent billing.transactionFees.capMinor"
      )
      .lean<SchoolRow | null>();
    const subaccountCode = school?.billing?.paystack?.subaccountCode ?? null;

    // Canonical payment charge resolution — §13A.12, §25.13
    let platformChargeMinor = 0;
    let parentPayerMode: "payer_pays" | "school_absorbs" | "waived" = "school_absorbs";
    let parentPayableMinor = amountMinor;
    try {
      const { resolvePaymentChargePolicy } = await import(
        "@/lib/subscriptions/resolve-payment-charge-policy"
      );
      const resolved = await resolvePaymentChargePolicy({
        schoolId: context.schoolId,
        category: "school_fee",
        amountMinor,
      });
      platformChargeMinor = resolved.chargeMinor;
      parentPayerMode = resolved.payerMode;
      // If payer pays, parent pays base + platform fee; otherwise parent pays only the base
      parentPayableMinor =
        parentPayerMode === "payer_pays"
          ? amountMinor + resolved.chargeMinor
          : amountMinor;
    } catch {
      // Fallback to existing legacy fee calculation
      const legacyBreakdown = computeTransactionFee(
        amountMinor,
        resolveTransactionFeeConfigForSchool(school?.billing?.transactionFees || null)
      );
      platformChargeMinor = legacyBreakdown.feeMinor;
      // Legacy always uses school absorbs
      parentPayerMode = "school_absorbs";
      parentPayableMinor = amountMinor;
    }

    if (!school || !isSchoolPaymentReady(school) || !subaccountCode) {
      const paymentSetupStatus = school
        ? deriveSchoolPaymentSetupStatus(school)
        : "not_started";
      return NextResponse.json(
        {
          success: false,
          error:
            "Online payments are not configured for this school yet. Please contact the school for payment options.",
          code: "school_payment_setup_incomplete",
          paymentSetupStatus,
        },
        { status: 409 }
      );
    }

    if (body.preview) {
      const paystackKeyMode = getPaystackKeyMode();
      return NextResponse.json({
        success: true,
        data: {
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber || "School Fees",
          amountMinor,
          parentPayableMinor,
          platformFeeMinor: platformChargeMinor,
          estimatedSchoolNetMinor: Math.max(
            0,
            parentPayerMode === "payer_pays"
              ? amountMinor
              : amountMinor - platformChargeMinor
          ),
          processorFeeNote:
            "Payment processor charges are calculated by the gateway at payment time and are deducted from the school's settlement.",
          payerMode: parentPayerMode,
          paystackKeyMode,
        },
      });
    }

    const user = await User.findById(context.userId).select("email").lean<{
      email?: string;
    } | null>();
    if (!user?.email) {
      return NextResponse.json(
        {
          success: false,
          error: "Your account is missing an email address required for checkout",
        },
        { status: 400 }
      );
    }

    const paymentIntent = await PaymentIntent.create({
      schoolId: context.schoolId,
      studentId: invoice.studentId,
      invoiceId: invoice._id,
      amountMinor,
      platformFeeMinor: platformChargeMinor,
      payerMode: parentPayerMode,
      parentPayableMinor,
      status: "initiated",
      paymentMethod: "paystack",
      idempotencyKey: randomUUID(),
      initiatedBy: context.userId,
      initiatedAt: new Date(),
    });
    paymentIntentId = paymentIntent._id as mongoose.Types.ObjectId;

    const appUrl = getAppUrl().replace(/\/$/, "");
    const mobileReturnUrl = normalizeMobileReturnUrl(body.returnUrl);
    const callbackPath = normalizeParentReturnPath(body.returnPath) || "/parent/fees";
    const callbackUrlObject = mobileReturnUrl
      ? new URL(mobileReturnUrl)
      : new URL(callbackPath, appUrl);
    callbackUrlObject.searchParams.set("checkout", "paystack");
    const callbackUrl = callbackUrlObject.toString();
    const reference = `EDSX-FEE-${String(paymentIntent._id)}-${Date.now()}`;

    try {
      const init = await initializeTransaction({
        email: user.email,
        amountMinor,
        reference,
        callbackUrl,
        currency: "GHS",
        subaccountCode,
        transactionChargeMinor:
          feeBreakdown.feeMinor > 0 ? feeBreakdown.feeMinor : null,
        bearer: feeBreakdown.feeMinor > 0 ? "subaccount" : undefined,
        metadata: {
          type: "fee_payment",
          schoolId: String(context.schoolId),
          invoiceId: String(invoice._id),
          studentId: String(invoice.studentId),
          paymentIntentId: String(paymentIntent._id),
          invoiceNumber: invoice.invoiceNumber || null,
          schoolName: school?.name || null,
          edusentrixTransactionFeeMinor: feeBreakdown.feeMinor,
          edusentrixTransactionFeePercent: feeBreakdown.percent,
          edusentrixTransactionFeeCapMinor: feeBreakdown.capMinor,
        },
      });

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await PaymentIntent.findByIdAndUpdate(paymentIntent._id, {
        $set: {
          status: "awaiting_webhook",
          paystackReference: init.reference,
          expiresAt,
          failureReason: null,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          authorizationUrl: init.authorization_url,
          reference: init.reference,
          amountMinor,
          platformFeeMinor: feeBreakdown.feeMinor,
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber || "School Fees",
          expiresAt: expiresAt.toISOString(),
          paystackKeyMode: getPaystackKeyMode(),
        },
      });
    } catch (initError) {
      const message =
        initError instanceof Error ? initError.message : "Checkout failed";
      await PaymentIntent.findByIdAndUpdate(paymentIntent._id, {
        $set: {
          status: "failed",
          failureReason: message,
        },
      });
      throw initError;
    }
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid checkout payload" },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to initialize checkout";
    console.error("Parent checkout initialization failed:", error);

    if (paymentIntentId) {
      await PaymentIntent.findByIdAndUpdate(paymentIntentId, {
        $set: {
          status: "failed",
          failureReason: message,
        },
      }).catch(() => undefined);
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
