import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { School } from "@/models/School";
import { persistOnboardingSchoolProfile } from "@/lib/onboarding/persist-onboarding-school-profile";
import { requireOnboardingSchoolActor } from "@/lib/onboarding/require-onboarding-school-actor";
import {
  MongoTransactionError,
  runMongoTransaction,
} from "@/lib/mongoose/run-transaction";

const BodySchema = z.object({
  schoolId: z.string().min(1),
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
      // sortCode is IGNORED (derived on server)
      sortCode: z.string().optional().nullable(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest) {
  const routeTag = "POST /api/onboarding/school";

  const { userId } = await auth();
  if (!userId) {
    console.log(`${routeTag} error`, { status: 401, message: "Unauthorized" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: ReturnType<typeof BodySchema.safeParse>;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch (e: unknown) {
    console.log(`${routeTag} error`, {
      status: 400,
      message: "Invalid JSON body",
      error: e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : e,
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!parsed.success) {
    console.log(`${routeTag} error`, {
      status: 400,
      message: "Invalid payload",
      zodIssues: parsed.error.issues,
    });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const actor = await requireOnboardingSchoolActor(userId);
  if (!actor.ok) {
    console.log(`${routeTag} error`, {
      status: actor.status,
      message: actor.error,
      clerkUserId: userId,
    });
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { user: me, school: resolvedSchool } = actor;
  const effectiveSchoolId = String(resolvedSchool._id);

  if (effectiveSchoolId !== parsed.data.schoolId) {
    console.log(`${routeTag} error`, {
      status: 403,
      message: "Forbidden for this school",
      userSchoolId: effectiveSchoolId,
      payloadSchoolId: parsed.data.schoolId,
    });
    return NextResponse.json(
      { error: "Forbidden for this school" },
      { status: 403 }
    );
  }

  try {
    const result = await runMongoTransaction(async (session) => {
      const school = await School.findById(resolvedSchool._id).session(session);
      if (!school) {
        throw new MongoTransactionError("School not found", 404);
      }

      const { schoolId: _sid, ...form } = parsed.data;
      return persistOnboardingSchoolProfile(
        school,
        form,
        me,
        me._id,
        session
      );
    });

    return NextResponse.json({
      success: true,
      data: {
        paymentSetupStatus: result.paymentSetupStatus,
        reviewReason: result.reviewReason,
      },
    });
  } catch (e: unknown) {
    if (e instanceof MongoTransactionError) {
      console.log(`${routeTag} error`, {
        status: e.statusCode,
        message: e.message,
      });
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : "Failed to save school profile";
    console.log(`${routeTag} error`, {
      status: 500,
      message: msg,
      error:
        e instanceof Error
          ? { name: e.name, message: e.message, stack: e.stack }
          : e,
    });
    return NextResponse.json(
      { error: "Failed to save school profile", details: msg },
      { status: 500 }
    );
  }
}
