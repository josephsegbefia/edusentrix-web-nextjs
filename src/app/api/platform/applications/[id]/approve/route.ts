/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Application } from "@/models/Application";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/brevo";

const BodySchema = z.object({
  note: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.res;
  const platformAdminId = guard.me!._id;

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await connectToDatabase();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const app = await Application.findById(params.id).session(session);
    if (!app) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }
    if (app.status !== "pending") {
      // idempotent-ish: if already approved, return ok
      await session.commitTransaction();
      return NextResponse.json({ success: true, already: app.status });
    }

    // 1) Create School (pending; full onboarding will activate it)
    const school = await School.create(
      [
        {
          name: app.schoolName,
          type: app.schoolType,
          address: app.address || undefined,
          city: app.city || undefined,
          region: app.region || undefined,
          status: "pending",
          createdBy: platformAdminId,
        },
      ],
      { session }
    ).then(([doc]) => doc);

    // 2) Ensure local User (by email); we do not require supabaseUserId yet
    const adminFullName = `${app.adminFirstName} ${app.adminLastName}`.trim();
    await User.updateOne(
      { email: app.adminEmail.toLowerCase() },
      {
        $set: {
          email: app.adminEmail.toLowerCase(),
          name: adminFullName,
          phone: app.adminPhone || null,
          role: "school_admin",
          schoolId: school._id,
          pendingOnboarding: true,
        },
        $setOnInsert: { createdBy: platformAdminId },
      },
      { upsert: true, session }
    );

    // 3) Mark application approved
    app.status = "approved";
    (app as any).reviewedBy = platformAdminId;
    (app as any).reviewNote = parsed.data?.note || null;
    (app as any).reviewedAt = new Date();
    await app.save({ session });

    await session.commitTransaction();

    // 4) Generate Supabase magic link (best effort) + send Brevo invite
    const APP_URL = process.env.APP_URL!;
    let setupLink = `${APP_URL}/onboard`; // fallback
    try {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: app.adminEmail,
        options: { redirectTo: `${APP_URL}/onboard` as any }, // supabase-js v2 typing uses redirectTo
      } as any);
      if (!error && data?.properties?.action_link)
        setupLink = data.properties.action_link;
    } catch {
      /* ignore, we have fallback */
    }

    await sendEmail(app.adminEmail, "SCHOOL_INVITE", {
      schoolName: app.schoolName,
      setupLink,
    });

    return NextResponse.json({ success: true, schoolId: school._id });
  } catch (e: any) {
    await session.abortTransaction();
    return NextResponse.json(
      { error: "Approval failed", details: e?.message || String(e) },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
