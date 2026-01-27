import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireRole } from "@/lib/auth/guards";
import { Invite } from "@/models/Invite";
import { School } from "@/models/School";
import { generateOnboardingMagicLink } from "@/lib/auth/generateOnboardingMagicLink";
import { sendEmail } from "@/lib/email/brevo";

const BodySchema = z.object({
  email: z.string().email(),
  schoolId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), "Invalid schoolId"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const staff = await requireRole("platform_admin", "staff");
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parse = BodySchema.safeParse(await req.json());
  if (!parse.success)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await connectToDatabase();
  const school = await School.findById(parse.data.schoolId);
  if (!school)
    return NextResponse.json({ error: "School not found" }, { status: 404 });

  const invite = await Invite.create({
    type: "school_admin",
    email: parse.data.email.toLowerCase(),
    schoolId: school._id,
    status: "pending",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    prefill: { firstName: parse.data.firstName, lastName: parse.data.lastName },
    createdBy: staff._id,
  });

  const link = await generateOnboardingMagicLink(parse.data.email);

  await sendEmail(parse.data.email, "SCHOOL_INVITE", {
    schoolName: `${school.name}`,
    setupLink: `${link}`,
  });

  return NextResponse.json({ success: true, inviteId: invite._id });
}
