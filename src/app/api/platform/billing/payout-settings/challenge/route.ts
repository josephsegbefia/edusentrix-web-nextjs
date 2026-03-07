import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { normalizePhone } from "@/lib/notifications/teacher-whatsapp-policy";
import { PlatformPayoutDestinationInputSchema } from "@/lib/platform-billing/payout-schemas";
import {
  generateOtpCode,
  hashOtpCode,
  maskPhoneNumber,
} from "@/lib/platform-billing/payout-security";
import { PlatformPayoutChangeChallenge } from "@/models/PlatformPayoutChangeChallenge";
import { User } from "@/models/User";

const ChallengeRequestSchema = z.object({
  subscriptionPayout: PlatformPayoutDestinationInputSchema,
  transactionFeePayout: PlatformPayoutDestinationInputSchema,
  changeNote: z.string().trim().max(240).optional().nullable().default(null),
});

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const body = ChallengeRequestSchema.parse(await req.json());
    const adminUserId = gate.me._id as mongoose.Types.ObjectId;

    const admin = await User.findById(adminUserId)
      .select("email phone")
      .lean<{ email?: string; phone?: string | null } | null>();

    if (!admin?.email) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your platform admin account needs an email address before payout accounts can be changed.",
        },
        { status: 409 }
      );
    }

    const normalizedPhone = normalizePhone(admin?.phone || null);
    if (!normalizedPhone) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your platform admin account needs a verified phone number before payout accounts can be changed.",
        },
        { status: 409 }
      );
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const dispatch = await sendWhatsAppMessage(
      normalizedPhone,
      "PLATFORM_PAYOUT_OTP",
      {
        code,
        action: "update payout routing",
        expires_minutes: "10",
      }
    );

    if (!dispatch.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            dispatch.error ||
            "Unable to deliver the verification code to your phone right now.",
        },
        { status: 503 }
      );
    }

    await PlatformPayoutChangeChallenge.deleteMany({
      adminUserId,
      purpose: "payout_account_change",
      consumedAt: null,
    });

    const challenge = await PlatformPayoutChangeChallenge.create({
      adminUserId,
      adminEmail: admin.email,
      phone: normalizedPhone,
      purpose: "payout_account_change",
      otpHash: hashOtpCode(code),
      attempts: 0,
      deliveryChannel: "whatsapp",
      deliveryMode: dispatch.mode,
      pendingUpdate: {
        subscriptionPayout: body.subscriptionPayout,
        transactionFeePayout: body.transactionFeePayout,
        changeNote: body.changeNote,
      },
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      data: {
        challengeId: String(challenge._id),
        maskedPhone: maskPhoneNumber(normalizedPhone),
        deliveryChannel: "whatsapp",
        deliveryMode: dispatch.mode,
        expiresAt: expiresAt.toISOString(),
        debugCode: process.env.NODE_ENV === "production" ? undefined : code,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid payout account change payload." },
        { status: 400 }
      );
    }

    console.error("Failed to create payout change challenge:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create payout change challenge",
      },
      { status: 500 }
    );
  }
}
