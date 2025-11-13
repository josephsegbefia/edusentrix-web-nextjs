/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { OTPChallenge, type IOtpChallenge } from "@/models/OTPChallenge";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, keyFor } from "@/lib/rate-limit";

const Body = z.object({
  email: z.string().email(),
  otp: z.string().length(6, "Enter the 6-digit code"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Must include a lowercase letter")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
  purpose: z.enum(["set_password", "reset_password"]).default("set_password"),
});

function getClientIp(req: NextRequest) {
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

  const { email, otp, password, purpose } = parsed.data;
  const ip = getClientIp(req);

  // Rate-limit: 10 provisions / hour (per ip,email)
  const rl = checkRateLimit(
    keyFor(ip, email, "provision-password"),
    10,
    60 * 60 * 1000
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  await connectToDatabase();

  const userDoc = (await User.findOne({ email: email.toLowerCase() })
    .select("_id email supabaseUserId")
    .lean()) as { _id: unknown; email: string; supabaseUserId?: string } | null;
  if (!userDoc) {
    // Generic message to limit enumeration
    return NextResponse.json(
      { error: "Invalid or expired code." },
      { status: 400 }
    );
  }

  // Validate OTP
  const challenge = (await OTPChallenge.findOne({
    email: email.toLowerCase(),
    purpose,
  }).lean()) as (IOtpChallenge & { _id: unknown }) | null;

  if (!challenge) {
    return NextResponse.json(
      { error: "Invalid or expired code." },
      { status: 400 }
    );
  }

  // Check expiry manually in case TTL hasn't purged yet
  if (challenge.expiresAt.getTime() < Date.now()) {
    await OTPChallenge.deleteOne({ _id: challenge._id });
    return NextResponse.json(
      { error: "Code expired. Request a new one." },
      { status: 400 }
    );
  }

  // Wrong attempts lock (simple)
  if (challenge.attempts >= 5) {
    return NextResponse.json(
      { error: "Too many invalid attempts. Request a new code." },
      { status: 429 }
    );
  }

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  if (otpHash !== challenge.otpHash) {
    await OTPChallenge.updateOne(
      { _id: challenge._id },
      { $inc: { attempts: 1 } }
    );
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  // OTP is valid → consume it (delete)
  await OTPChallenge.deleteOne({ _id: challenge._id });

  // Ensure Supabase user exists and set/repair password
  const admin = supabaseAdmin;

  if (userDoc.supabaseUserId) {
    // Update password for existing Supabase user
    const upd = await admin.auth.admin.updateUserById(userDoc.supabaseUserId, {
      password,
    });
    if (upd.error) {
      // Edge: if "User not found" in Supabase, recreate
      const recreate = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (recreate.error) {
        return NextResponse.json(
          { error: recreate.error.message || "Failed to set password" },
          { status: 400 }
        );
      }
      await User.updateOne(
        { _id: (userDoc as any)._id },
        {
          $set: {
            supabaseUserId: recreate.data.user?.id,
            passwordSetAt: new Date(),
          },
        }
      );
      return NextResponse.json({ ok: true });
    }
    // Success path
    await User.updateOne(
      { _id: (userDoc as any)._id },
      { $set: { passwordSetAt: new Date() } }
    );
    return NextResponse.json({ ok: true });
  }

  // No supabaseUserId in Mongo → create Supabase user now
  const create = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (create.error) {
    return NextResponse.json(
      { error: create.error.message || "Failed to create account" },
      { status: 400 }
    );
  }

  await User.updateOne(
    { _id: (userDoc as any)._id },
    {
      $set: { supabaseUserId: create.data.user?.id, passwordSetAt: new Date() },
    }
  );

  return NextResponse.json({ ok: true });
}
