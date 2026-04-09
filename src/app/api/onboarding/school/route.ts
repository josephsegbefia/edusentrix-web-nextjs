/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { School } from "@/models/School";
import { resolveBankCode } from "@/lib/banks/banks";
import {
  assessSchoolPaymentSetupReview,
  hasCompleteSchoolBankDetails,
} from "@/lib/school-payments/payment-setup";

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
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await connectToDatabase();

  const meResult = (await User.findOne({
    clerkUserId: userId,
  }).lean()) as IUser | null;
  const me = meResult;
  if (!me?.schoolId)
    return NextResponse.json({ error: "No school bound" }, { status: 409 });
  if (String(me.schoolId) !== parsed.data.schoolId) {
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
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    // Resolve bank code from DB; ignore client sortCode
    let derivedSortCode: string | null = null;
    const bankReq = parsed.data.bank || undefined;
    if (bankReq?.bankName && bankReq?.branchName) {
      derivedSortCode = await resolveBankCode(
        bankReq.bankName,
        bankReq.branchName
      );
    }

    const normalizedType =
      parsed.data.type === "Secondary" ? "SHS" : parsed.data.type;

    school.name = parsed.data.name;
    school.type = normalizedType;
    if (parsed.data.curriculumCode) {
      (school as any).curriculumCode = parsed.data.curriculumCode;
    }
    school.address = parsed.data.address ?? undefined;
    school.email = parsed.data.email ?? undefined;
    school.city = parsed.data.city ?? undefined;
    school.region = parsed.data.region ?? undefined;

    const existingBank = school.bank || {};

    school.bank = {
      bankName: bankReq?.bankName || undefined,
      branchName: bankReq?.branchName || undefined,
      sortCode: derivedSortCode || undefined,
      accountName: bankReq?.accountName || undefined,
      accountNumber: bankReq?.accountNumber || undefined,
    };

    const paymentDetailsReady = hasCompleteSchoolBankDetails({
      bank: school.bank,
      billing: school.billing,
    });
    const bankChanged =
      (existingBank.bankName || "") !== (bankReq?.bankName || "") ||
      (existingBank.branchName || "") !== (bankReq?.branchName || "") ||
      (existingBank.accountName || "") !== (bankReq?.accountName || "") ||
      (existingBank.accountNumber || "") !== (bankReq?.accountNumber || "");
    const review = paymentDetailsReady
      ? assessSchoolPaymentSetupReview({
          schoolName: school.name,
          accountName: bankReq?.accountName || null,
          hadProvisionedRail: Boolean(
            school.billing?.paystack?.subaccountCode ||
              school.billing?.paystack?.subaccountId
          ),
          bankChanged,
        })
      : { requiresReview: false, reason: null };
    const billing = school.billing || (school.billing = {});
    const existingPaymentSetup = billing.paymentSetup || {};
    const paymentSetupUpdatedAt = new Date();

    billing.paymentSetup = {
      ...existingPaymentSetup,
      ownerUserId: existingPaymentSetup.ownerUserId || me._id,
      ownerName:
        existingPaymentSetup.ownerName ||
        me.name ||
        [me.firstName, me.lastName].filter(Boolean).join(" ") ||
        undefined,
      ownerEmail: existingPaymentSetup.ownerEmail || me.email,
      ownerAssignedAt: existingPaymentSetup.ownerAssignedAt || paymentSetupUpdatedAt,
      ownerAssignedBy: existingPaymentSetup.ownerAssignedBy || me._id,
      status: paymentDetailsReady
        ? review.requiresReview
          ? "review_required"
          : "details_submitted"
        : "not_started",
      submittedAt: paymentDetailsReady ? paymentSetupUpdatedAt : null,
      submittedBy: paymentDetailsReady ? me._id : null,
      reviewReason: paymentDetailsReady ? review.reason : null,
      lastUpdatedAt: paymentSetupUpdatedAt,
      lastUpdatedBy: me._id,
    };

    // Do NOT call Paystack here; just persist. Provisioning will be enqueued on /finish
    await school.save({ session });

    await session.commitTransaction();
    return NextResponse.json({
      success: true,
      data: {
        paymentSetupStatus: school.billing?.paymentSetup?.status || "not_started",
        reviewReason: school.billing?.paymentSetup?.reviewReason || null,
      },
    });
  } catch (e: any) {
    await session.abortTransaction();
    return NextResponse.json(
      { error: "Failed to save school profile", details: e?.message },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
