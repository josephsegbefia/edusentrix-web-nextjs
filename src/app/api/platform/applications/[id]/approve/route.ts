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
  const platformAdminId = guard.me!._id;

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await connectToDatabase();
  const session = await mongoose.startSession();

  const { id } = await ctx.params;

  try {
    let schoolIdCreated: mongoose.Types.ObjectId | null = null;

    await session.withTransaction(async () => {
      const app = await Application.findById(id).session(session);

      if (!app) throw new Error("Application not found");

      // Only allow approve from 'submitted' or 'reviewed'
      if (!["submitted", "reviewed"].includes(app.status)) {
        // if already approved, treat as idempotent success
        if (app.status === "approved") return;
        throw new Error(
          `Invalid state transition from '${app.status}' to 'approved'`
        );
      }

      // 1) Create School (pending; onboarding will flip to active)
      const school = await School.create(
        [
          {
            name: app.schoolName,
            type: app.schoolType,
            address: (app as any).address || undefined, // only if you actually store address on Application
            city: app.city || undefined,
            region: app.region || undefined,
            status: "pending",
            createdBy: platformAdminId,
          },
        ],
        { session }
      ).then(([doc]) => doc);
      schoolIdCreated = school._id;

      // 2) Ensure local User (by email); supabaseUserId may be added later on first login
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
        },
        { upsert: true, session }
      );

      // 3) Update application + link to school + mark who processed
      app.status = "approved";
      app.linkedSchoolId = school._id as any;
      app.processedBy = platformAdminId as any;
      await app.save({ session });

      // 4) Audit
      await recordApplicationAudit(
        {
          applicationId: app._id,
          action: "approved",
          by: platformAdminId,
          note: parsed.data?.note,
          meta: { linkedSchoolId: String(school._id) },
        },
        { session }
      );
    });

    // 5) Generate magic link (best-effort) + email
    const APP_URL = process.env.APP_URL!;
    const applicationDoc = await Application.findById(id).lean();
    if (!applicationDoc || Array.isArray(applicationDoc)) {
      throw new Error("Application not found");
    }
    let setupLink = `${APP_URL}/onboard`;

    try {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: applicationDoc.adminEmail,
        options: { redirectTo: `${APP_URL}/onboard` as any },
      } as any);
      if (!error && data?.properties?.action_link) {
        setupLink = data.properties.action_link;
      }
    } catch {
      /* ignore; fallback in place */
    }

    // send invite
    try {
      await sendEmail(applicationDoc.adminEmail, "SCHOOL_INVITE", {
        schoolName: applicationDoc.schoolName,
        setupLink,
      });
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({ success: true, schoolId: schoolIdCreated });
  } catch (e: any) {
    console.log("Error approving application", e);
    return NextResponse.json(
      { error: "Approval failed", details: e?.message || String(e) },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
