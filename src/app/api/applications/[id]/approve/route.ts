import { NextRequest, NextResponse } from "next/server";
import { Types, startSession } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Application } from "@/models/Application";
import { School } from "@/models/School";
import { Invite } from "@/models/Invite";
import { requireRole } from "@/lib/auth/guards";
import { generateOnboardingMagicLink } from "@/server/invites/generateOnboardingMagicLink";
import { sendEmail } from "@/lib/email/brevo";

const ParamsSchema = z.object({
  id: z.string().refine((v) => Types.ObjectId.isValid(v), "Invalid id"),
});

// Optional override fields during approval

const BodySchema = z.object({
  schoolType: z.enum(["Basic", "Scondary"]).optional(),
  // if you want to override name or address at approval time
  schoolName: z.string().min(2).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params;

  const staff = await requireRole("platform_admin", "staff");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const p = ParamsSchema.safeParse(params);

  if (!p.success)
    return NextResponse.json({ error: p.error.message }, { status: 400 });

  const body = BodySchema.safeParse(await req.json());
  if (!body.success)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await connectToDatabase();

  const app = await Application.findById(p.data.id);
  if (!app)
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  if (app.status !== "submitted" && app.status !== "reviewed") {
    return NextResponse.json(
      { error: "Application not in approvable state" },
      { status: 409 }
    );
  }

  const session = await startSession();
  try {
    session.startTransaction();

    const school = await School.create(
      [
        {
          name: body.data.schoolName ?? app.schoolName,
          type: body.data.schoolType ?? app.schoolType,
          address: body.data.address,
          city: body.data.city ?? app.city,
          region: body.data.region ?? app.region,
          status: "pending",

          createdBy: staff._id,
        },
      ],
      { session }
    ).then((res) => res[0]);

    const invite = await Invite.create(
      [
        {
          type: "school_admin",
          email: app.adminEmail.toLowerCase(),
          schoolId: school._id,
          status: "pending",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
          prefill: {
            firstName: app.adminFirstName,
            lastName: app.adminLastName,
          },

          createdBy: staff._id,
        },
      ],
      { session }
    ).then((res) => res[0]);

    app.status = "approved";
    app.linkedSchoolId = school._id;
    app.processedBy = staff._id;
    await app.save({ session });

    await session.commitTransaction();

    const link = await generateOnboardingMagicLink(app.adminEmail);

    await sendEmail(app.adminEmail, "SCHOOL_INVITE", {
      schoolName: school.name,
      setupLink: `${link}`,
    });

    return NextResponse.json({
      success: true,
      schoolId: school._id,
      inviteId: invite._id,
    });
  } catch (error) {
    await session.abortTransaction();
    return NextResponse.json(
      { error: "Approval failed", details: `${error}` },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
