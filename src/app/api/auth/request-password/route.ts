import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { OTPChallenge } from "@/models/OTPChallenge";
import { checkRateLimit, keyFor } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/brevo";

const Body = z.object({
  email: z.string().email(),
  purpose: z.enum(["set_password", "reset_password"]).default("set_password"),
});

function getClientIp(req: NextRequest) {
  // Trust proxy headers; Next.js sets these behind Vercel, etc.
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid payload" },
      { status: 400 }
    );
  }

  const { email, purpose } = parsed.data;
  const ip = getClientIp(req);

  // Soft rate-limit: 5 requests / 15 minutes per (ip,email,route)
  const rl = checkRateLimit(
    keyFor(ip, email, "request-password"),
    5,
    15 * 60 * 1000
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  await connectToDatabase();

  // Optional: we only issue OTP if email exists in our DB to avoid user confusion,
  // but reply with a generic message either way to prevent enumeration.
  const userDoc = await User.findOne({ email: email.toLowerCase() })
    .select("_id email supabaseUserId passwordSetAt")
    .lean();

  // Always answer generically to avoid email enumeration
  // but if user exists, we create OTP challenge and send email.
  if (userDoc) {
    // Create 6-digit code
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert most-recent challenge for this email+purpose
    await OTPChallenge.findOneAndUpdate(
      { email: email.toLowerCase(), purpose },
      { $set: { otpHash, attempts: 0, createdAt: new Date(), expiresAt } },
      { upsert: true, new: true }
    );

    // Send OTP email (update to your template / variables)
    // Make sure you’ve created a template like "PASSWORD_OTP"
    try {
      await sendEmail(email, "PASSWORD_OTP", {
        code: otp,
        // Include a subtle hint to use within 10 minutes, etc.
      });
    } catch {
      // do not leak info to client
    }
  }

  // Generic success (no enumeration)
  return NextResponse.json({ ok: true });
}
