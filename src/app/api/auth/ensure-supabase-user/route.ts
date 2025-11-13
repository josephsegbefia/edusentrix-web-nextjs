/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Must include a lowercase letter")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid payload" },
      { status: 400 }
    );
  }
  const { email, password } = parsed.data;

  await connectToDatabase();
  const userDocRaw = (await User.findOne({ email: email.toLowerCase() })
    .select("_id email supabaseUserId")
    .lean()) as { _id: unknown; email: string; supabaseUserId?: string } | null;

  if (!userDocRaw) {
    return NextResponse.json(
      { error: "Email not recognized." },
      { status: 404 }
    );
  }

  // Type assertion after null check - userDoc is guaranteed to be non-null
  const userDoc = userDocRaw as {
    _id: unknown;
    email: string;
    supabaseUserId?: string;
  };

  const admin = supabaseAdmin;

  // If we already know the supabase user id, try update password first.
  if (userDoc.supabaseUserId) {
    const attemptUpdate = await admin.auth.admin.updateUserById(
      userDoc.supabaseUserId,
      { password }
    );

    if (attemptUpdate.error && /not found/i.test(attemptUpdate.error.message)) {
      // Edge: record exists in Mongo but not in Supabase anymore → recreate
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error) {
        return NextResponse.json(
          { error: created.error.message || "Failed to create account" },
          { status: 400 }
        );
      }
      await User.updateOne(
        { _id: (userDoc as any)._id },
        { $set: { supabaseUserId: created.data.user?.id } }
      );
      return NextResponse.json({ ok: true });
    }

    if (attemptUpdate.error) {
      return NextResponse.json(
        { error: attemptUpdate.error.message || "Failed to update password" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  // No supabaseUserId on our record → create user now.
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (created.error) {
    return NextResponse.json(
      { error: created.error.message || "Failed to create account" },
      { status: 400 }
    );
  }

  await User.updateOne(
    { _id: (userDoc as any)._id },
    { $set: { supabaseUserId: created.data.user?.id } }
  );

  return NextResponse.json({ ok: true });
}
