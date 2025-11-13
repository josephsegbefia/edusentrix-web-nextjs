// src/app/api/platform/applications/[id]/approve/route.ts
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
import { recordApplicationAudit } from "@/lib/audit/recordApplicationAudit";

const BodySchema = z.object({
  note: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.res;
  const reviewerId = guard.me!._id;
  const { id } = await ctx.params;

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await connectToDatabase();
  const session = await mongoose.connection.startSession();

  try {
    let schoolIdCreated: mongoose.Types.ObjectId | null = null;

    await session.withTransaction(async () => {
      const app = await Application.findById(id).session(session);
      if (!app) throw new Error("Application not found");

      if (!["submitted", "reviewed"].includes(app.status)) {
        if (app.status === "approved") return; // idempotent
        throw new Error(`Invalid transition from '${app.status}' → approved`);
      }

      // 1) Create or reuse School
      let school = app.linkedSchoolId
        ? await School.findById(app.linkedSchoolId).session(session)
        : null;

      if (!school) {
        school = await School.create(
          [
            {
              name: app.schoolName,
              type: app.schoolType,
              address: (app as any).address || undefined,
              city: app.city || undefined,
              region: app.region || undefined,
              status: "pending",
              createdBy: reviewerId,
            },
          ],
          { session }
        ).then(([doc]) => doc);
      } else {
        school.status = "pending";
        await school.save({ session });
      }
      schoolIdCreated = school._id;

      // 2) Ensure Supabase user exists and capture supabaseUserId
      const email = app.adminEmail.toLowerCase();
      const fullName = `${app.adminFirstName} ${app.adminLastName}`.trim();

      // Try to find an existing Supabase user by email
      const existing = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      let supabaseUserId: string | null = null;
      if (!existing.error) {
        const found = existing.data?.users?.find((u) => u.email === email);
        supabaseUserId = found?.id ?? null;
      }

      if (!supabaseUserId) {
        // Create a Supabase user (confirmed) without starting a session
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { name: fullName, createdBy: "platform_approval" },
        });
        if (error) throw error;
        supabaseUserId = data.user?.id ?? null;
        if (!supabaseUserId) throw new Error("No Supabase user id returned");
      }

      // 3) Upsert Mongo user with that supabaseUserId
      await User.updateOne(
        { supabaseUserId },
        {
          $set: {
            supabaseUserId,
            email,
            name: fullName,
            phone: app.adminPhone || null,
            role: "school_admin",
            schoolId: school._id,
            pendingOnboarding: true,
          },
        },
        { upsert: true, session }
      );

      // 4) Update application and audit
      app.status = "approved";
      app.linkedSchoolId = school._id as any;
      app.processedBy = reviewerId as any;
      await app.save({ session });

      await recordApplicationAudit(
        {
          applicationId: app._id,
          action: "approved",
          by: reviewerId,
          note: parsed.data?.note,
          meta: { linkedSchoolId: String(school._id) },
        },
        { session }
      );
    });

    // 5) Send a **password setup** link (recovery) to /auth/reset
    const APP_URL = process.env.APP_URL!;
    const appDoc = await Application.findById(id).lean();
    if (!appDoc || Array.isArray(appDoc)) {
      throw new Error("Application not found after approval");
    }

    let setupLink = `${APP_URL}/auth/reset`;
    try {
      // Generate a "recovery" (set password) link that lands on our reset page
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: appDoc.adminEmail,
        options: {
          redirectTo: `${APP_URL}/auth/reset` as any,
        },
      } as any);
      if (!error && data?.properties?.action_link) {
        setupLink = data.properties.action_link;
      }
    } catch {
      /* fallback already set */
    }

    // 6) Email the school admin
    try {
      await sendEmail(appDoc.adminEmail, "SCHOOL_INVITE", {
        schoolName: appDoc.schoolName,
        setupLink,
      });
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({ success: true, schoolId: schoolIdCreated });
  } catch (e: any) {
    console.log("Approval failed", e);
    return NextResponse.json(
      { error: "Approval failed", details: e?.message || String(e) },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
