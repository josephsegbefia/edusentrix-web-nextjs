import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { hashOtpCode, maskAccountNumber } from "@/lib/platform-billing/payout-security";
import { PlatformBillingSettings } from "@/models/PlatformBillingSettings";
import type { IPlatformBillingSettings } from "@/models/PlatformBillingSettings";
import { PlatformPayoutChangeChallenge } from "@/models/PlatformPayoutChangeChallenge";

const VerifyRequestSchema = z.object({
  challengeId: z.string().trim().min(1),
  code: z.string().trim().regex(/^\d{6}$/),
});

type PlatformBillingSettingsDoc = mongoose.Document<
  unknown,
  {},
  IPlatformBillingSettings
> &
  IPlatformBillingSettings;

function serializeSettings(doc: PlatformBillingSettingsDoc | null) {
  const auditLog = Array.isArray(doc?.auditLog) ? doc.auditLog : [];

  return {
    subscriptionPayout: doc?.subscriptionPayout || null,
    transactionFeePayout: doc?.transactionFeePayout || null,
    lastVerifiedAt: doc?.lastVerifiedAt?.toISOString?.() || null,
    updatedByEmail: doc?.updatedByEmail || null,
    updatedAt: doc?.updatedAt?.toISOString?.() || null,
    auditLog: auditLog
      .slice(-5)
      .reverse()
      .map((entry) => ({
        changedAt: entry.changedAt?.toISOString?.() || null,
        changedByEmail: entry.changedByEmail || null,
        summary: entry.summary || null,
        subscriptionPayoutMasked: entry.subscriptionPayoutMasked || null,
        transactionFeePayoutMasked: entry.transactionFeePayoutMasked || null,
      })),
  };
}

export async function GET() {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const settings = await PlatformBillingSettings.findOne({ key: "default" });

    return NextResponse.json({
      success: true,
      data: serializeSettings(settings),
    });
  } catch (error) {
    console.error("Failed to load platform payout settings:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load platform payout settings",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const body = VerifyRequestSchema.parse(await req.json());
    if (!mongoose.Types.ObjectId.isValid(body.challengeId)) {
      return NextResponse.json(
        { success: false, error: "Invalid verification challenge." },
        { status: 400 }
      );
    }

    const adminUserId = gate.me._id as mongoose.Types.ObjectId;
    const challenge = await PlatformPayoutChangeChallenge.findOne({
      _id: new mongoose.Types.ObjectId(body.challengeId),
      adminUserId,
      purpose: "payout_account_change",
      consumedAt: null,
    });

    if (!challenge) {
      return NextResponse.json(
        { success: false, error: "Verification challenge not found." },
        { status: 404 }
      );
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      challenge.consumedAt = new Date();
      await challenge.save();
      return NextResponse.json(
        { success: false, error: "Verification code has expired." },
        { status: 410 }
      );
    }

    const hashedCode = hashOtpCode(body.code);
    if (hashedCode !== challenge.otpHash) {
      challenge.attempts += 1;
      if (challenge.attempts >= 5) {
        challenge.consumedAt = new Date();
      }
      await challenge.save();

      return NextResponse.json(
        {
          success: false,
          error:
            challenge.attempts >= 5
              ? "Too many incorrect verification attempts. Request a new code."
              : "Incorrect verification code.",
        },
        { status: challenge.attempts >= 5 ? 429 : 401 }
      );
    }

    const now = new Date();
    const changeSummary =
      challenge.pendingUpdate.changeNote ||
      "Payout routing updated after phone verification.";

    const settings = await PlatformBillingSettings.findOneAndUpdate(
      { key: "default" },
      {
        $set: {
          subscriptionPayout: challenge.pendingUpdate.subscriptionPayout,
          transactionFeePayout: challenge.pendingUpdate.transactionFeePayout,
          lastVerifiedAt: now,
          updatedBy: adminUserId,
          updatedByEmail: challenge.adminEmail,
        },
        $push: {
          auditLog: {
            changedAt: now,
            changedBy: adminUserId,
            changedByEmail: challenge.adminEmail,
            summary: changeSummary,
            subscriptionPayoutMasked: maskAccountNumber(
              challenge.pendingUpdate.subscriptionPayout.accountNumber
            ),
            transactionFeePayoutMasked: maskAccountNumber(
              challenge.pendingUpdate.transactionFeePayout.accountNumber
            ),
          },
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    challenge.consumedAt = now;
    await challenge.save();

    return NextResponse.json({
      success: true,
      data: serializeSettings(settings),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid verification payload." },
        { status: 400 }
      );
    }

    console.error("Failed to verify payout settings change:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to verify payout settings change",
      },
      { status: 500 }
    );
  }
}
