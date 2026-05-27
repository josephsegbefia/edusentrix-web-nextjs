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
import { School } from "@/models/School";
import { StoreOrder } from "@/models/StoreOrder";
import { StoreProduct } from "@/models/StoreProduct";
import { Student } from "@/models/Student";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";
import { User } from "@/models/User";
import { studentMatchesProgramAudience } from "@/lib/supply-programs/eligibility";
import { getPaidQtyBySupplyLine } from "@/lib/supply-programs/progress";
import {
  deriveSchoolPaymentSetupStatus,
  isSchoolPaymentReady,
} from "@/lib/school-payments/payment-setup";

type SchoolForPaymentCheck = Parameters<typeof isSchoolPaymentReady>[0];

const LineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  /** Required when checking out against a supply program */
  supplyProgramLineId: z.string().optional(),
});

const BodySchema = z.object({
  studentId: z.string().min(1),
  lines: z.array(LineSchema).min(1).max(50),
  preview: z.boolean().optional().default(false),
  returnPath: z.string().trim().optional(),
  /** When set, every line must include supplyProgramLineId; quantities capped at remaining need */
  supplyProgramId: z.string().optional(),
});

type SchoolRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  billing?: {
    status?: "unprovisioned" | "provisioned" | "failed" | null;
    paymentSetup?: { status?: string | null } | null;
    paystack?: { subaccountCode?: string | null };
    transactionFees?: {
      mode?: "platform_default" | "custom" | "disabled" | null;
      percent?: number | null;
      capMinor?: number | null;
    };
  };
};

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

export async function POST(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const body = BodySchema.parse(await req.json());
    if (!mongoose.Types.ObjectId.isValid(body.studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    const studentId = new mongoose.Types.ObjectId(body.studentId);
    const guardian = await Guardian.findOne({
      userId: context.userId,
      studentId,
    }).select("_id");
    if (!guardian) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this student" },
        { status: 403 }
      );
    }

    const student = await Student.findOne({
      _id: studentId,
      schoolId: context.schoolId,
    })
      .select("_id firstName lastName gradeId classGroupId")
      .lean<{
        _id: mongoose.Types.ObjectId;
        firstName: string;
        lastName: string;
        gradeId: mongoose.Types.ObjectId;
        classGroupId: mongoose.Types.ObjectId;
      } | null>();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const productIds = body.lines.map((l) => l.productId);
    const uniqueIds = [...new Set(productIds)].filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    const products = await StoreProduct.find({
      _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) },
      schoolId: context.schoolId,
      isActive: true,
    }).lean();

    const productMap = new Map(
      products.map((p) => [String(p._id), p as typeof products[0]])
    );

    let supplyProgramOid: mongoose.Types.ObjectId | null = null;
    if (body.supplyProgramId) {
      if (!mongoose.Types.ObjectId.isValid(body.supplyProgramId)) {
        return NextResponse.json(
          { success: false, error: "Invalid supply program id" },
          { status: 400 }
        );
      }
      supplyProgramOid = new mongoose.Types.ObjectId(body.supplyProgramId);
      const program = await SupplyProgram.findOne({
        _id: supplyProgramOid,
        schoolId: context.schoolId,
        status: "published",
      }).lean();
      if (!program) {
        return NextResponse.json(
          { success: false, error: "Supply program not found or not published" },
          { status: 404 }
        );
      }
      if (
        !studentMatchesProgramAudience(
          {
            _id: student._id,
            gradeId: student.gradeId,
            classGroupId: student.classGroupId,
          },
          program
        )
      ) {
        return NextResponse.json(
          { success: false, error: "This supply list does not apply to this student" },
          { status: 403 }
        );
      }
      for (const line of body.lines) {
        if (
          !line.supplyProgramLineId ||
          !mongoose.Types.ObjectId.isValid(line.supplyProgramLineId)
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Each cart line must include a valid supplyProgramLineId for program checkout",
            },
            { status: 400 }
          );
        }
      }
    } else {
      for (const line of body.lines) {
        if (line.supplyProgramLineId) {
          return NextResponse.json(
            {
              success: false,
              error: "Remove supplyProgramLineId or provide supplyProgramId for the order",
            },
            { status: 400 }
          );
        }
      }
    }

    const supplyLineOids: mongoose.Types.ObjectId[] = [];
    if (supplyProgramOid) {
      for (const line of body.lines) {
        supplyLineOids.push(
          new mongoose.Types.ObjectId(line.supplyProgramLineId!)
        );
      }
    }
    const paidByLine =
      supplyLineOids.length > 0
        ? await getPaidQtyBySupplyLine(context.schoolId, studentId, supplyLineOids)
        : new Map<string, number>();

    const orderLines: Array<{
      productId: mongoose.Types.ObjectId;
      nameSnapshot: string;
      unitPriceMinor: number;
      quantity: number;
      lineTotalMinor: number;
      supplyProgramId?: mongoose.Types.ObjectId | null;
      supplyProgramLineId?: mongoose.Types.ObjectId | null;
    }> = [];

    let totalMinor = 0;
    for (const line of body.lines) {
      const p = productMap.get(line.productId);
      if (!p) {
        return NextResponse.json(
          {
            success: false,
            error: `Product unavailable or not found: ${line.productId}`,
          },
          { status: 400 }
        );
      }
      const unit = Math.round(Number(p.priceMinor || 0));
      const qty = line.quantity;
      let supplyProgramId: mongoose.Types.ObjectId | null = null;
      let supplyProgramLineId: mongoose.Types.ObjectId | null = null;

      if (supplyProgramOid && line.supplyProgramLineId) {
        const pl = await SupplyProgramLine.findOne({
          _id: new mongoose.Types.ObjectId(line.supplyProgramLineId),
          programId: supplyProgramOid,
        }).lean();
        if (!pl) {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid supply line: ${line.supplyProgramLineId}`,
            },
            { status: 400 }
          );
        }
        if (String(pl.storeProductId) !== String(p._id)) {
          return NextResponse.json(
            {
              success: false,
              error: "Product does not match the supply list line",
            },
            { status: 400 }
          );
        }
        const need = Math.max(1, pl.quantity || 1);
        const paid = paidByLine.get(String(pl._id)) ?? 0;
        const remaining = Math.max(0, need - paid);
        if (qty > remaining) {
          return NextResponse.json(
            {
              success: false,
              error: `Quantity exceeds remaining for "${p.name}" (${remaining} left)`,
            },
            { status: 400 }
          );
        }
        supplyProgramId = supplyProgramOid;
        supplyProgramLineId = pl._id as mongoose.Types.ObjectId;
      }

      const lineTotal = unit * qty;
      totalMinor += lineTotal;
      orderLines.push({
        productId: p._id as mongoose.Types.ObjectId,
        nameSnapshot: String(p.name),
        unitPriceMinor: unit,
        quantity: qty,
        lineTotalMinor: lineTotal,
        supplyProgramId,
        supplyProgramLineId,
      });
    }

    if (totalMinor <= 0) {
      return NextResponse.json(
        { success: false, error: "Order total must be greater than zero" },
        { status: 400 }
      );
    }

    const school = await School.findById(context.schoolId)
      .select(
        "name billing.status billing.paymentSetup billing.paystack.subaccountCode billing.transactionFees.mode billing.transactionFees.percent billing.transactionFees.capMinor"
      )
      .lean<SchoolRow | null>();
    const subaccountCode = school?.billing?.paystack?.subaccountCode ?? null;

    // Subscription-aware fee resolution (no-op while SUBSCRIPTION_PAYMENT_CHARGES_ENABLED=false)
    let feeBreakdown: { feeMinor: number; percent: number; capMinor: number | null };
    try {
      const { resolveTransactionChargeConfig, computeTransactionFeeFromConfig } = await import(
        "@/lib/subscriptions/transaction-fees"
      );
      const { SchoolSubscription } = await import("@/models/SchoolSubscription");
      const sub = await SchoolSubscription.findOne({ schoolId: context.schoolId })
        .select("tierCode transactionChargeOverride")
        .lean<{ tierCode?: string; transactionChargeOverride?: unknown } | null>();
      const planCode = sub?.tierCode as import("@/lib/subscriptions/plan-codes").PlanCode | null | undefined;
      const resolution = resolveTransactionChargeConfig(planCode ?? null, sub?.transactionChargeOverride as any ?? null);
      const fee = computeTransactionFeeFromConfig(totalMinor, resolution.schoolFeesConfig);
      feeBreakdown = { feeMinor: fee, percent: resolution.schoolFeesConfig.ratePercent, capMinor: resolution.schoolFeesConfig.capMinor };
    } catch {
      feeBreakdown = computeTransactionFee(
        totalMinor,
        resolveTransactionFeeConfigForSchool(school?.billing?.transactionFees || null)
      );
    }

    const schoolForPayments = school as SchoolForPaymentCheck | null;
    if (!schoolForPayments || !isSchoolPaymentReady(schoolForPayments) || !subaccountCode) {
      const paymentSetupStatus = schoolForPayments
        ? deriveSchoolPaymentSetupStatus(schoolForPayments)
        : "not_started";
      return NextResponse.json(
        {
          success: false,
          error:
            "Online payments are not configured for this school yet. Please contact the school.",
          code: "school_payment_setup_incomplete",
          paymentSetupStatus,
        },
        { status: 409 }
      );
    }

    if (body.preview) {
      return NextResponse.json({
        success: true,
        data: {
          studentId: String(studentId),
          wardName: `${student.firstName} ${student.lastName}`,
          totalMinor,
          platformFeeMinor: feeBreakdown.feeMinor,
          estimatedSchoolNetMinor: Math.max(0, totalMinor - feeBreakdown.feeMinor),
          paystackKeyMode: getPaystackKeyMode(),
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

    const idempotencyKey = randomUUID();
    const order = await StoreOrder.create({
      schoolId: context.schoolId,
      parentUserId: context.userId,
      studentId,
      supplyProgramId: supplyProgramOid,
      lines: orderLines,
      totalMinor,
      currency: "GHS",
      status: "pending_payment",
      idempotencyKey,
    });

    const appUrl = getAppUrl().replace(/\/$/, "");
    const callbackPath =
      normalizeParentReturnPath(body.returnPath) ||
      (supplyProgramOid ? "/parent/supplies" : "/parent/store");
    const callbackUrlObject = new URL(callbackPath, appUrl);
    callbackUrlObject.searchParams.set("checkout", "paystack");
    const callbackUrl = callbackUrlObject.toString();
    const reference = `EDSX-STO-${String(order._id)}-${Date.now()}`;

    let init: Awaited<ReturnType<typeof initializeTransaction>>;
    try {
      init = await initializeTransaction({
        email: user.email,
        amountMinor: totalMinor,
        reference,
        callbackUrl,
        currency: "GHS",
        subaccountCode,
        transactionChargeMinor:
          feeBreakdown.feeMinor > 0 ? feeBreakdown.feeMinor : null,
        bearer: feeBreakdown.feeMinor > 0 ? "subaccount" : undefined,
        metadata: {
          type: "store_order",
          schoolId: String(context.schoolId),
          storeOrderId: String(order._id),
          studentId: String(studentId),
          parentUserId: String(context.userId),
          ...(supplyProgramOid
            ? { supplyProgramId: String(supplyProgramOid) }
            : {}),
          edusentrixTransactionFeeMinor: feeBreakdown.feeMinor,
          edusentrixTransactionFeePercent: feeBreakdown.percent,
          edusentrixTransactionFeeCapMinor: feeBreakdown.capMinor,
        },
      });
    } catch (initErr) {
      const msg =
        initErr instanceof Error ? initErr.message : "Paystack initialize failed";
      await StoreOrder.findByIdAndUpdate(order._id, {
        $set: { status: "failed", failureReason: msg },
      });
      throw initErr;
    }

    await StoreOrder.findByIdAndUpdate(order._id, {
      $set: { paystackReference: init.reference },
    });

    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl: init.authorization_url,
        reference: init.reference,
        orderId: String(order._id),
        totalMinor,
        platformFeeMinor: feeBreakdown.feeMinor,
        paystackKeyMode: getPaystackKeyMode(),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Store checkout error:", error);
    const message =
      error instanceof Error ? error.message : "Checkout failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
