import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePaymentSetupAccess } from "@/lib/auth/requirePaymentSetupAccess";
import { maskAccountNumber } from "@/lib/platform-billing/payout-security";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildFinanceStaffAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { AuditPolicyError, AuditValidationError } from "@/lib/audit/errors";
import { School } from "@/models/School";

const BodySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reason is required (at least 3 characters)")
    .max(2000),
});

function maskLast4(n: string) {
  return n.length >= 4 ? n.slice(-4) : n;
}

export async function POST(req: NextRequest) {
  try {
    const access = await requirePaymentSetupAccess();
    if (!access.capabilities.canManage) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only billing setup users can reveal payout account details.",
        },
        { status: 403 }
      );
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid request",
        },
        { status: 400 }
      );
    }

    const school = await School.findById(access.schoolId).select("bank").lean();
    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    const accountNumber = (school.bank?.accountNumber || "").trim();
    if (!accountNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "No payout account is stored on file yet.",
        },
        { status: 400 }
      );
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await writeTransactionalAuditEvent(session, {
          actionCode: "data.unmasked",
          scopeType: "school",
          scopeId: String(access.schoolId),
          result: "succeeded",
          target: {
            targetEntityType: "School",
            targetEntityId: school._id,
          },
          context: buildFinanceStaffAuditContext(req, {
            userId: access.userId as mongoose.Types.ObjectId,
            schoolId: access.schoolId as mongoose.Types.ObjectId,
            roles: access.roles,
            actorEmail: access.userEmail,
            actorName: access.userName,
            idempotencyKey: resolveAuditIdempotencyKey(
              req,
              `data.unmasked:${String(access.schoolId)}:${Date.now()}`
            ),
          }),
          reason: {
            reasonCode: "payout_account_unmask",
            reason: parsed.data.reason,
          },
          payload: {
            metadata: {
              resourceKind: "payout_bank_account",
              accountLast4: maskLast4(accountNumber),
              maskedAccountNumber: maskAccountNumber(accountNumber),
            },
          },
          streamKey: `school:${String(access.schoolId)}:finance`,
        });
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({
      success: true,
      data: {
        accountNumber,
        maskedAccountNumber: maskAccountNumber(accountNumber),
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    if (error instanceof AuditValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    if (error instanceof AuditPolicyError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    console.error("payment-setup unmask failed:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not complete reveal (audit write failed)",
      },
      { status: 500 }
    );
  }
}
