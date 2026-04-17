import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import type { IUser } from "@/models/User";
import { persistOnboardingSchoolProfile } from "@/lib/onboarding/persist-onboarding-school-profile";
import { getOnboardingTargetSchoolAdmin } from "@/lib/onboarding/target-school-admin";

const BodySchema = z.object({
  name: z.string().min(2),
  type: z.enum(["Basic", "Secondary"]),
  curriculumCode: z
    .enum([
      "ghana_nacca",
      "cambridge",
      "ib_pyp",
      "ib_myp",
      "british_nc",
      "american",
      "hybrid",
    ])
    .optional(),
  address: z.string().nullable().optional(),
  email: z.email().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  bank: z
    .object({
      bankName: z.string().nullable().optional(),
      branchName: z.string().nullable().optional(),
      accountName: z.string().nullable().optional(),
      accountNumber: z.string().nullable().optional(),
      sortCode: z.string().optional().nullable(),
    })
    .nullable()
    .optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await connectToDatabase();

  const schoolId = new mongoose.Types.ObjectId(id);
  const target = (await getOnboardingTargetSchoolAdmin(
    schoolId
  )) as IUser | null;
  if (!target) {
    return NextResponse.json(
      { error: "No school admin found for this school." },
      { status: 409 }
    );
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const school = await School.findById(schoolId).session(session);
    if (!school) {
      await session.abortTransaction();
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const result = await persistOnboardingSchoolProfile(
      school,
      parsed.data,
      target,
      gate.me._id as mongoose.Types.ObjectId,
      session
    );

    await session.commitTransaction();
    return NextResponse.json({
      success: true,
      data: {
        paymentSetupStatus: result.paymentSetupStatus,
        reviewReason: result.reviewReason,
      },
    });
  } catch (e: unknown) {
    await session.abortTransaction();
    const msg = e instanceof Error ? e.message : "Failed to save school profile";
    return NextResponse.json(
      { error: "Failed to save school profile", details: msg },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
