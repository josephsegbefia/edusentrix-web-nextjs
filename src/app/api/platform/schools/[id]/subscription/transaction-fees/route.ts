import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { resolveTransactionFeeConfigForSchool } from "@/lib/billing/transaction-fees";
import { School } from "@/models/School";

const TransactionFeeSchema = z
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

async function updateFeePolicy(input: {
  schoolId: mongoose.Types.ObjectId;
  mode: "platform_default" | "custom" | "disabled";
  percent?: number | null;
  capMinor?: number | null;
  notes?: string | null;
  adminUserId: mongoose.Types.ObjectId;
}) {
  const updated = await School.findByIdAndUpdate(
    input.schoolId,
    {
      $set: {
        "billing.transactionFees.mode": input.mode,
        "billing.transactionFees.percent": input.mode === "custom" ? input.percent ?? null : null,
        "billing.transactionFees.capMinor": input.mode === "custom" ? input.capMinor ?? null : null,
        "billing.transactionFees.notes": input.notes || null,
        "billing.transactionFees.updatedAt": new Date(),
        "billing.transactionFees.updatedBy": input.adminUserId,
      },
    },
    { new: true }
  )
    .select(
      "name billing.transactionFees.mode billing.transactionFees.percent billing.transactionFees.capMinor billing.transactionFees.notes billing.transactionFees.updatedAt"
    )
    .lean<{
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
    } | null>();

  if (!updated) return null;
  const policy = updated.billing?.transactionFees || null;
  const effective = resolveTransactionFeeConfigForSchool(policy);

  return {
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
  };
}

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

    const body = TransactionFeeSchema.parse(await req.json());
    const result = await updateFeePolicy({
      schoolId: new mongoose.Types.ObjectId(id),
      mode: body.mode,
      percent: body.percent,
      capMinor: body.capMinor,
      notes: body.notes,
      adminUserId: gate.me._id as mongoose.Types.ObjectId,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "School not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid transaction fee payload." },
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

export async function DELETE(
  _req: NextRequest,
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

    const result = await updateFeePolicy({
      schoolId: new mongoose.Types.ObjectId(id),
      mode: "platform_default",
      adminUserId: gate.me._id as mongoose.Types.ObjectId,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "School not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Failed to remove school transaction fee policy:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove school transaction fee policy",
      },
      { status: 500 }
    );
  }
}
