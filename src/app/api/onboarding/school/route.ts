import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { School } from "@/models/School";
import { persistOnboardingSchoolProfile } from "@/lib/onboarding/persist-onboarding-school-profile";

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

  const meResult = (await User.findOne({
    clerkUserId: userId,
  }).lean()) as IUser | null;
  const me = meResult;
  if (!me?.schoolId) {
    console.log(`${routeTag} error`, { status: 409, message: "No school bound", clerkUserId: userId });
    return NextResponse.json({ error: "No school bound" }, { status: 409 });
  }
  if (String(me.schoolId) !== parsed.data.schoolId) {
    console.log(`${routeTag} error`, {
      status: 403,
      message: "Forbidden for this school",
      userSchoolId: String(me.schoolId),
      payloadSchoolId: parsed.data.schoolId,
    });
    return NextResponse.json(
      { error: "Forbidden for this school" },
      { status: 403 }
    );
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const school = await School.findById(me.schoolId).session(session);
    if (!school) {
      await session.abortTransaction();
      console.log(`${routeTag} error`, {
        status: 404,
        message: "School not found",
        schoolId: String(me.schoolId),
      });
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const { schoolId: _sid, ...form } = parsed.data;
    const result = await persistOnboardingSchoolProfile(
      school,
      form,
      me,
      me._id,
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
    await session.abortTransaction().catch(() => {});
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
  } finally {
    session.endSession();
  }
}
