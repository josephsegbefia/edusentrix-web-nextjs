import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { sendRawEmail } from "@/lib/email/brevo";
import {
  BOOTSTRAP_MAX_OTP_SENDS_PER_HOUR,
  BOOTSTRAP_OTP_TTL_MS,
  getBootstrapNotifyEmail,
} from "@/lib/platform-bootstrap/config";
import {
  assertBootstrapConfigured,
  bootstrapKeyFingerprint,
  isValidBootstrapPathSecret,
} from "@/lib/platform-bootstrap/key";
import {
  generateOtpCode,
  hashOtpCode,
} from "@/lib/platform-billing/payout-security";
import { PlatformBootstrapOtp } from "@/models/PlatformBootstrapOtp";

export const runtime = "nodejs";

const bodySchema = z.object({
  secret: z.string().min(8),
});

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "***";
  const keep = local.slice(0, 1);
  return `${keep}***@${domain}`;
}

export async function POST(req: NextRequest) {
  try {
    assertBootstrapConfigured();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
    }

    const { secret } = parsed.data;
    if (!isValidBootstrapPathSecret(secret)) {
      return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
    }

    await connectToDatabase();

    const fp = bootstrapKeyFingerprint(secret);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSends = await PlatformBootstrapOtp.countDocuments({
      bootstrapKeyFingerprint: fp,
      createdAt: { $gte: hourAgo },
    });
    if (recentSends >= BOOTSTRAP_MAX_OTP_SENDS_PER_HOUR) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many code requests. Try again later.",
        },
        { status: 429 }
      );
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + BOOTSTRAP_OTP_TTL_MS);

    await PlatformBootstrapOtp.deleteMany({
      bootstrapKeyFingerprint: fp,
      expiresAt: { $gt: new Date() },
    });

    await PlatformBootstrapOtp.create({
      bootstrapKeyFingerprint: fp,
      otpHash: hashOtpCode(code),
      attempts: 0,
      expiresAt,
    });

    const notify = getBootstrapNotifyEmail();
    await sendRawEmail({
      to: notify,
      subject: "Edusentrix — platform admin bootstrap code",
      htmlContent: `
        <p>Use this code to unlock the platform admin creation form:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 0.2em;">${code}</p>
        <p>This code expires in ${Math.round(BOOTSTRAP_OTP_TTL_MS / 60000)} minutes.</p>
        <p>If you did not request this, ignore this email and rotate <code>PLATFORM_ADMIN_BOOTSTRAP_SECRET</code>.</p>
      `,
    });

    return NextResponse.json({
      success: true,
      data: {
        notifyEmailMasked: maskEmail(notify),
        expiresInSeconds: Math.round(BOOTSTRAP_OTP_TTL_MS / 1000),
        ...(process.env.NODE_ENV !== "production" ? { _debugCode: code } : {}),
      },
    });
  } catch (error) {
    console.error("[bootstrap/otp/send]", error);
    const message =
      error instanceof Error ? error.message : "Failed to send verification code.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
