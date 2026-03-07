import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { resolveTransactionFeeConfigForSchool } from "@/lib/billing/transaction-fees";
import { School } from "@/models/School";

const UpdateSchoolFeePolicySchema = z
  .object({
    mode: z.enum(["platform_default", "custom", "disabled"]),
    percent: z.number().min(0).max(100).nullable().optional().default(null),
    capMinor: z.number().int().min(0).nullable().optional().default(null),
    notes: z.string().trim().max(240).nullable().optional().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "custom" && value.percent === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["percent"],
        message: "Percent is required when a custom fee policy is selected.",
      });
    }
  });

type UpdatedSchoolRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  billing?: {
    transactionFees?: {
      mode?: "platform_default" | "custom" | "disabled" | null;
      percent?: number | null;
      capMinor?: number | null;
      notes?: string | null;
      updatedAt?: Date | null;
    };
  };
};

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ schoolId: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { schoolId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const body = UpdateSchoolFeePolicySchema.parse(await req.json());
    const now = new Date();
    const adminUserId = gate.me._id as mongoose.Types.ObjectId;

    const updated = await School.findByIdAndUpdate(
      new mongoose.Types.ObjectId(schoolId),
      {
        $set: {
          "billing.transactionFees.mode": body.mode,
          "billing.transactionFees.percent":
            body.mode === "custom" ? body.percent : null,
          "billing.transactionFees.capMinor":
            body.mode === "custom" ? body.capMinor : null,
          "billing.transactionFees.notes": body.notes,
          "billing.transactionFees.updatedAt": now,
          "billing.transactionFees.updatedBy": adminUserId,
        },
      },
      {
        new: true,
      }
    )
      .select(
        "name billing.transactionFees.mode billing.transactionFees.percent billing.transactionFees.capMinor billing.transactionFees.notes billing.transactionFees.updatedAt"
      )
      .lean<UpdatedSchoolRow | null>();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "School not found." },
        { status: 404 }
      );
    }

    const policy = updated.billing?.transactionFees || null;
    const effective = resolveTransactionFeeConfigForSchool(policy);

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
        name: updated.name || "Unnamed School",
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
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid school fee policy payload." },
        { status: 400 }
      );
    }

    console.error("Failed to update school transaction fee policy:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update school transaction fee policy",
      },
      { status: 500 }
    );
  }
}
