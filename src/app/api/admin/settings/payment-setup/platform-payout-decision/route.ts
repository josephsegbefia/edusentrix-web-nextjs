import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePaymentSetupAccess } from "@/lib/auth/requirePaymentSetupAccess";
import {
  assessSchoolPaymentSetupReview,
  canSchoolUserDecidePlatformPayoutProposal,
} from "@/lib/school-payments/payment-setup";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildFinanceStaffAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { recordActivity } from "@/lib/audit/recordActivity";
import { School } from "@/models/School";

const DecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

function maskLast4(n?: string | null) {
  return n && n.length >= 4 ? n.slice(-4) : null;
}

export async function POST(req: NextRequest) {
  try {
    const access = await requirePaymentSetupAccess();
    const body = DecisionSchema.parse(await req.json());

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const school = await School.findById(access.schoolId).session(session);
        if (!school) {
          throw new Error("SCHOOL_NOT_FOUND");
        }

        const pending = school.billing?.paymentSetup?.pendingPlatformPayout;
        if (!pending?.bankName?.trim() || !pending.accountNumber?.trim()) {
          throw new Error("NO_PENDING");
        }

        if (!canSchoolUserDecidePlatformPayoutProposal(access, school)) {
          throw new Error("FORBIDDEN_DECIDE");
        }

        const now = new Date();
        const existingBank = school.bank || {};
        const billing = school.billing || (school.billing = {});
        const existingPaymentSetup = billing.paymentSetup || {};
        const existingPaystack = billing.paystack || {};

        if (body.action === "reject") {
          billing.paymentSetup = {
            ...existingPaymentSetup,
            pendingPlatformPayout: null,
            lastUpdatedAt: now,
            lastUpdatedBy: access.userId,
          };

          await school.save({ session });

          await writeTransactionalAuditEvent(session, {
            actionCode: "billing.platform_payout_proposal.decided",
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
                `billing.platform_payout_proposal.rejected:${String(access.schoolId)}`
              ),
            }),
            reason: {
              reasonCode: "school_rejected_platform_proposal",
              reason: "School rejected the platform payout proposal.",
            },
            payload: {
              before: {
                pendingBankName: pending.bankName,
                accountLast4: maskLast4(pending.accountNumber),
              },
              after: { status: "rejected" },
              metadata: { action: "reject" },
            },
            streamKey: `school:${String(access.schoolId)}:finance`,
          });
          return;
        }

        const hadProvisionedRail = Boolean(
          existingPaystack.subaccountCode || existingPaystack.subaccountId
        );
        const bankChanged =
          (existingBank.bankName || "") !== pending.bankName ||
          (existingBank.branchName || "") !== pending.branchName ||
          (existingBank.accountName || "") !== pending.accountName ||
          (existingBank.accountNumber || "") !== pending.accountNumber;

        const review = assessSchoolPaymentSetupReview({
          schoolName: school.name,
          accountName: pending.accountName,
          hadProvisionedRail,
          bankChanged,
        });

        school.bank = {
          bankName: pending.bankName!,
          branchName: pending.branchName!,
          sortCode: pending.sortCode || (existingBank.sortCode as string),
          accountName: pending.accountName!,
          accountNumber: pending.accountNumber!,
        };

        billing.status = bankChanged ? "unprovisioned" : billing.status || "unprovisioned";
        billing.paymentSetup = {
          ...existingPaymentSetup,
          ownerUserId: existingPaymentSetup.ownerUserId || null,
          ownerName: existingPaymentSetup.ownerName || null,
          ownerEmail: existingPaymentSetup.ownerEmail || null,
          ownerAssignedAt: existingPaymentSetup.ownerAssignedAt || null,
          ownerAssignedBy: existingPaymentSetup.ownerAssignedBy || null,
          delegateUserId: existingPaymentSetup.delegateUserId || null,
          delegateName: existingPaymentSetup.delegateName || null,
          delegateEmail: existingPaymentSetup.delegateEmail || null,
          delegateAssignedAt: existingPaymentSetup.delegateAssignedAt || null,
          delegateAssignedBy: existingPaymentSetup.delegateAssignedBy || null,
          pendingPlatformPayout: null,
          status: review.requiresReview ? "review_required" : "details_submitted",
          submittedAt: now,
          submittedBy: access.userId,
          approvedAt: bankChanged ? null : existingPaymentSetup.approvedAt || null,
          approvedBy: bankChanged ? null : existingPaymentSetup.approvedBy || null,
          approvedByEmail: bankChanged
            ? null
            : existingPaymentSetup.approvedByEmail || null,
          reviewReason: review.reason,
          lastUpdatedAt: now,
          lastUpdatedBy: access.userId,
        };
        billing.paystack = {
          ...existingPaystack,
          subaccountCode: bankChanged ? null : existingPaystack.subaccountCode || null,
          subaccountId: bankChanged ? null : existingPaystack.subaccountId || null,
          lastError: null,
          lastErrorDetail: null,
          lastErrorAt: null,
        };

        await school.save({ session });

        await writeTransactionalAuditEvent(session, {
          actionCode: "billing.platform_payout_proposal.decided",
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
              `billing.platform_payout_proposal.approved:${String(access.schoolId)}`
            ),
          }),
          reason: {
            reasonCode: "school_accepted_platform_proposal",
            reason: pending.note || "School approved platform payout proposal.",
          },
          payload: {
            before: {
              bankName: existingBank.bankName,
              branchName: existingBank.branchName,
              accountName: existingBank.accountName,
              accountLast4: maskLast4(existingBank.accountNumber),
            },
            after: {
              bankName: pending.bankName,
              branchName: pending.branchName,
              accountName: pending.accountName,
              accountLast4: maskLast4(pending.accountNumber),
            },
            metadata: {
              reviewRequired: review.requiresReview,
            },
          },
          streamKey: `school:${String(access.schoolId)}:finance`,
        });
      });
    } finally {
      await session.endSession();
    }

    if (body.action === "reject") {
      await recordActivity({
        schoolId: access.schoolId,
        userId: access.userId,
        type: "payout.platform_proposal_rejected",
        entityType: "school_payment_setup",
        entityId: access.schoolId,
        description: "School rejected a platform-proposed payout update.",
        metadata: { schoolId: String(access.schoolId) },
      });
    } else {
      await recordActivity({
        schoolId: access.schoolId,
        userId: access.userId,
        type: "payout.platform_proposal_approved",
        entityType: "school_payment_setup",
        entityId: access.schoolId,
        description: "School approved a platform-proposed payout update.",
        metadata: { schoolId: String(access.schoolId) },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        action: body.action,
        message:
          body.action === "approve"
            ? "Payout details were updated from the platform proposal."
            : "Platform proposal was dismissed. Existing bank details were kept.",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Invalid payload." },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "SCHOOL_NOT_FOUND") {
      return NextResponse.json(
        { success: false, error: "School not found." },
        { status: 404 }
      );
    }
    if (error instanceof Error && error.message === "NO_PENDING") {
      return NextResponse.json(
        { success: false, error: "There is no platform payout proposal to act on." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "FORBIDDEN_DECIDE") {
      return NextResponse.json(
        {
          success: false,
          error:
            "You do not have authority to approve this change. The billing owner must approve when online payments were already live.",
        },
        { status: 403 }
      );
    }

    console.error("Platform payout decision error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to process proposal.",
      },
      { status: 500 }
    );
  }
}
