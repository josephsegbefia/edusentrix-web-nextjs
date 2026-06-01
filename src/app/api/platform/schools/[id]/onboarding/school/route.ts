import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import type { IUser } from "@/models/User";
import { persistOnboardingSchoolProfile } from "@/lib/onboarding/persist-onboarding-school-profile";
import { getOnboardingTargetSchoolAdmin } from "@/lib/onboarding/target-school-admin";
import {
  MongoTransactionError,
  runMongoTransaction,
} from "@/lib/mongoose/run-transaction";

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
  const { id: schoolIdParam } = await context.params;
  const routeTag = `POST /api/platform/schools/${schoolIdParam}/onboarding/school`;

  const gate = await requirePlatformAdmin();
  if (!gate.ok) {
    console.log(`${routeTag} error`, {
      status: gate.res.status,
      message: "Platform admin gate failed",
    });
    return gate.res;
  }

  if (!mongoose.Types.ObjectId.isValid(schoolIdParam)) {
    console.log(`${routeTag} error`, { status: 400, message: "Invalid school id", schoolIdParam });
    return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
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

  try {
    await connectToDatabase();
  } catch (e: unknown) {
    console.log(`${routeTag} error`, {
      status: 500,
      message: "Database connection failed",
      error: e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : e,
    });
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    );
  }

  const schoolId = new mongoose.Types.ObjectId(schoolIdParam);
  const target = (await getOnboardingTargetSchoolAdmin(
    schoolId
  )) as IUser | null;
  if (!target) {
    console.log(`${routeTag} error`, {
      status: 409,
      message: "No school admin found for this school.",
      schoolId: schoolIdParam,
    });
    return NextResponse.json(
      { error: "No school admin found for this school." },
      { status: 409 }
    );
  }

  try {
    const result = await runMongoTransaction(async (session) => {
      const school = await School.findById(schoolId).session(session);
      if (!school) {
        throw new MongoTransactionError("School not found", 404);
      }

      return persistOnboardingSchoolProfile(
        school,
        parsed.data,
        target,
        gate.me._id as mongoose.Types.ObjectId,
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
        schoolId: schoolIdParam,
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
