import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import connectToDatabase from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { School, type ISchool } from "@/models/School";
import { enqueueSchoolPaymentProvisioning } from "@/lib/jobs/payment-provisioning";
import {
  deriveSchoolPaymentSetupStatus,
  hasCompleteSchoolBankDetails,
} from "@/lib/school-payments/payment-setup";
import { applyLaunchCurriculum } from "@/lib/onboarding/launch-curriculum";
import { getOnboardingTargetSchoolAdmin } from "@/lib/onboarding/target-school-admin";

const BodySchema = z
  .object({
    subjects: z.array(z.string()).optional(),
    periods: z
      .array(
        z.object({
          yearLabel: z.string().min(1),
          term: z.string().min(1),
          startDate: z.string().min(1),
          endDate: z.string().min(1),
          isCurrent: z.boolean().optional(),
        })
      )
      .optional(),
  })
  .optional();

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const body = parsed.data;
  const subjectList = body?.subjects;
  const periodList = body?.periods;

  await connectToDatabase();

  const schoolIdObj = new mongoose.Types.ObjectId(id);

  const target = await getOnboardingTargetSchoolAdmin(schoolIdObj);
  if (!target?._id) {
    return NextResponse.json(
      { error: "No school admin found for this school." },
      { status: 409 }
    );
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    if (
      (subjectList && subjectList.length > 0) ||
      (periodList && periodList.length > 0)
    ) {
      await applyLaunchCurriculum(
        schoolIdObj,
        {
          subjectNames: subjectList ?? [],
          periods: periodList ?? [],
        },
        { session }
      );
    }

    await User.updateOne(
      { _id: target._id, schoolId: schoolIdObj },
      { $set: { pendingOnboarding: false } },
      { session }
    );
    await School.updateOne(
      { _id: schoolIdObj },
      {
        $set: {
          status: "active",
          "onboarding.finishedAt": new Date(),
        },
      },
      { session }
    );

    await session.commitTransaction();
  } catch (e: unknown) {
    await session.abortTransaction();
    const msg =
      e instanceof Error ? e.message : "Failed to finalize onboarding";
    return NextResponse.json({ error: msg }, { status: 400 });
  } finally {
    session.endSession();
  }

  const school = await School.findById(schoolIdObj)
    .select("bank billing")
    .lean<Pick<ISchool, "bank" | "billing"> | null>();

  if (
    school &&
    hasCompleteSchoolBankDetails(school) &&
    deriveSchoolPaymentSetupStatus(school) !== "review_required"
  ) {
    await enqueueSchoolPaymentProvisioning({
      schoolId: schoolIdObj,
    });
  }

  return NextResponse.json({ ok: true });
}
