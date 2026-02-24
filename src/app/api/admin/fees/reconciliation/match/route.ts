import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { applyManualReconciliationMatch } from "@/lib/fees/reconciliation/deterministic";

const BodySchema = z.object({
  ingestionId: z.string().min(1),
  paymentId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

function toObjectId(value: string, label: string) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return new mongoose.Types.ObjectId(value);
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid reconciliation match payload." },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj =
      userId && mongoose.Types.ObjectId.isValid(String(userId))
        ? new mongoose.Types.ObjectId(String(userId))
        : null;

    const result = await applyManualReconciliationMatch({
      schoolId: schoolIdObj,
      userId: userIdObj,
      ingestionId: toObjectId(parsed.data.ingestionId, "ingestionId"),
      paymentId: toObjectId(parsed.data.paymentId, "paymentId"),
      note: parsed.data.note || null,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const message =
      error instanceof Error ? error.message : "Failed to match reconciliation item.";
    const status = message.startsWith("Invalid ") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
