import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { resolveBankCode } from "@/lib/banks/banks";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildPlatformSchoolAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { recordActivity } from "@/lib/audit/recordActivity";
import { School } from "@/models/School";
import { omitUndefinedDeep } from "@/lib/mongoose/omit-undefined-deep";

const ProposeSchema = z.object({
  bankName: z.string().trim().min(1, "Bank is required"),
  branchName: z.string().trim().min(1, "Branch is required"),
  accountName: z.string().trim().min(2, "Account name is required"),
  accountNumber: z
    .string()
    .trim()
    .min(6, "Account number is required")
    .max(32, "Account number is too long"),
  note: z.string().trim().max(500).nullable().optional(),
});

function maskLast4(n?: string | null) {
  return n && n.length >= 4 ? n.slice(-4) : null;
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

    const body = ProposeSchema.parse(await req.json());
    const schoolId = new mongoose.Types.ObjectId(id);

    await connectToDatabase();

    const derivedSortCode = await resolveBankCode(body.bankName, body.branchName);
    if (!derivedSortCode) {
      return NextResponse.json(
        {
          success: false,
          error: "We could not match that bank branch to a valid sort code.",
        },
        { status: 400 }
      );
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const school = await School.findById(schoolId).session(session);
        if (!school) {
          throw new Error("SCHOOL_NOT_FOUND");
        }
        const existing = school.billing?.paymentSetup?.pendingPlatformPayout;
        if (existing?.bankName?.trim()) {
          throw new Error("PENDING_EXISTS");
        }

        const existingBank = school.bank || {};
        const now = new Date();
        const note = body.note?.trim() || null;

        const billing = school.billing || (school.billing = {});
        const paymentSetup = billing.paymentSetup || (billing.paymentSetup = {});
        paymentSetup.pendingPlatformPayout = omitUndefinedDeep({
          bankName: body.bankName,
          branchName: body.branchName,
          sortCode: derivedSortCode ?? null,
          accountName: body.accountName,
          accountNumber: body.accountNumber,
          note,
          proposedBy: gate.me._id,
          proposedByEmail:
            "email" in gate.me && typeof gate.me.email === "string"
              ? gate.me.email.toLowerCase().trim()
              : null,
          proposedAt: now,
        }) as typeof paymentSetup.pendingPlatformPayout;
        paymentSetup.lastUpdatedAt = now;
        paymentSetup.lastUpdatedBy = gate.me._id;

        await school.save({ session });

        await writeTransactionalAuditEvent(session, {
          actionCode: "billing.platform_payout_proposal.submitted",
          scopeType: "school",
          scopeId: String(schoolId),
          result: "succeeded",
          target: {
            targetEntityType: "School",
            targetEntityId: school._id,
          },
          context: buildPlatformSchoolAuditContext(req, {
            platformAdminId: gate.me._id,
            schoolId,
            actorEmail:
              "email" in gate.me && typeof gate.me.email === "string"
                ? gate.me.email
                : null,
            actorName: null,
            idempotencyKey: resolveAuditIdempotencyKey(
              req,
              `billing.platform_payout_proposal.submitted:${String(schoolId)}`
            ),
          }),
          reason: {
            reasonCode: "platform_payout_proposal",
            reason: note || "Platform proposed a payout destination update for school approval.",
          },
          payload: {
            before: {
              bankName: existingBank.bankName,
              branchName: existingBank.branchName,
              accountName: existingBank.accountName,
              accountLast4: maskLast4(existingBank.accountNumber),
            },
            after: {
              bankName: body.bankName,
              branchName: body.branchName,
              accountName: body.accountName,
              accountLast4: maskLast4(body.accountNumber),
            },
            metadata: { sortCode: derivedSortCode },
          },
          streamKey: `school:${String(schoolId)}:finance`,
        });
      });
    } finally {
      await session.endSession();
    }

    await recordActivity({
      schoolId,
      userId: gate.me._id,
      type: "payout.platform_proposal_submitted",
      entityType: "school_payment_setup",
      entityId: schoolId,
      description: `Platform submitted a payout correction proposal for school ${id}`,
      metadata: { schoolId: String(schoolId) },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Proposal saved. A school billing contact must approve it." },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.issues[0]?.message || "Invalid proposal.",
        },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "SCHOOL_NOT_FOUND") {
      return NextResponse.json(
        { success: false, error: "School not found." },
        { status: 404 }
      );
    }
    if (error instanceof Error && error.message === "PENDING_EXISTS") {
      return NextResponse.json(
        {
          success: false,
          error: "A payout proposal is already pending. Withdraw it before submitting a new one.",
        },
        { status: 409 }
      );
    }

    console.error("Payout proposal error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to save payout proposal.",
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

    const schoolId = new mongoose.Types.ObjectId(id);
    await connectToDatabase();

    const school = await School.findById(schoolId).select("name billing");
    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found." },
        { status: 404 }
      );
    }

    if (!school.billing?.paymentSetup?.pendingPlatformPayout?.bankName?.trim()) {
      return NextResponse.json({
        success: true,
        data: { cleared: false },
      });
    }

    school.billing = school.billing || {};
    school.billing.paymentSetup = school.billing.paymentSetup || {};
    school.billing.paymentSetup.pendingPlatformPayout = null;
    school.billing.paymentSetup.lastUpdatedAt = new Date();
    school.billing.paymentSetup.lastUpdatedBy = gate.me._id;
    await school.save();

    await recordActivity({
      schoolId,
      userId: gate.me._id,
      type: "payout.platform_proposal_withdrawn",
      entityType: "school_payment_setup",
      entityId: schoolId,
      description: `Platform withdrew a payout proposal for ${school.name || "school"}`,
      metadata: { schoolId: String(schoolId) },
    });

    return NextResponse.json({ success: true, data: { cleared: true } });
  } catch (error) {
    console.error("Withdraw payout proposal error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to withdraw proposal.",
      },
      { status: 500 }
    );
  }
}
