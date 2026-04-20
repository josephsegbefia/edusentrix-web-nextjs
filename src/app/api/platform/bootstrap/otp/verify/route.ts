import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  BOOTSTRAP_MAX_OTP_ATTEMPTS,
  BOOTSTRAP_SESSION_COOKIE,
  BOOTSTRAP_SESSION_TTL_MS,
} from "@/lib/platform-bootstrap/config";
import {
  assertBootstrapConfigured,
  bootstrapKeyFingerprint,
  isValidBootstrapPathSecret,
} from "@/lib/platform-bootstrap/key";
import { hashOtpCode } from "@/lib/platform-billing/payout-security";
import { PlatformBootstrapOtp } from "@/models/PlatformBootstrapOtp";
import { PlatformBootstrapSession } from "@/models/PlatformBootstrapSession";

export const runtime = "nodejs";

const bodySchema = z.object({
  secret: z.string().min(8),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    assertBootstrapConfigured();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid code format." }, { status: 400 });
    }

    const { secret, code } = parsed.data;
    if (!isValidBootstrapPathSecret(secret)) {
      return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
    }

    await connectToDatabase();
    const fp = bootstrapKeyFingerprint(secret);

    const challenge = await PlatformBootstrapOtp.findOne({
      bootstrapKeyFingerprint: fp,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!challenge) {
      return NextResponse.json(
        { success: false, error: "No active code. Request a new one." },
        { status: 400 }
      );
    }

    if (challenge.attempts >= BOOTSTRAP_MAX_OTP_ATTEMPTS) {
      await PlatformBootstrapOtp.deleteOne({ _id: challenge._id });
      return NextResponse.json(
        { success: false, error: "Too many attempts. Request a new code." },
        { status: 429 }
      );
    }

    if (challenge.otpHash !== hashOtpCode(code)) {
      await PlatformBootstrapOtp.updateOne(
        { _id: challenge._id },
        { $inc: { attempts: 1 } }
      );
      return NextResponse.json({ success: false, error: "Incorrect code." }, { status: 401 });
    }

    await PlatformBootstrapOtp.deleteMany({ bootstrapKeyFingerprint: fp });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const sessionTokenHash = hashOtpCode(rawToken);
    const expiresAt = new Date(Date.now() + BOOTSTRAP_SESSION_TTL_MS);

    await PlatformBootstrapSession.deleteMany({
      bootstrapKeyFingerprint: fp,
      consumedAt: null,
    });

    await PlatformBootstrapSession.create({
      sessionTokenHash,
      bootstrapKeyFingerprint: fp,
      expiresAt,
      consumedAt: null,
    });

    const res = NextResponse.json({
      success: true,
      data: { sessionExpiresInSeconds: Math.round(BOOTSTRAP_SESSION_TTL_MS / 1000) },
    });

    res.cookies.set(BOOTSTRAP_SESSION_COOKIE, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: Math.round(BOOTSTRAP_SESSION_TTL_MS / 1000),
    });

    return res;
  } catch (error) {
    console.error("[bootstrap/otp/verify]", error);
    return NextResponse.json(
      { success: false, error: "Verification failed." },
      { status: 500 }
    );
  }
}
