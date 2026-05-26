import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { getSchoolLearnEligibility } from "@/lib/learn/eligibility";
import { getOrCreateLearnPlatformSettings } from "@/lib/learn/platform-settings";
import { getPaystackKeyMode, initializeTransaction } from "@/lib/paystack";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AuditEvent } from "@/models/AuditEvent";
import { Guardian } from "@/models/Guardian";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Student } from "@/models/Student";
import { User } from "@/models/User";

const BodySchema = z.object({
  studentId: z.string().min(1),
  preview: z.boolean().optional().default(false),
  returnPath: z.string().trim().optional(),
});

type StudentRow = {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  status?: string | null;
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
};

type AccountRow = {
  _id: Types.ObjectId;
  status: string;
};

type PeriodRow = {
  _id: Types.ObjectId;
  endDate: Date;
};

function normalizeParentReturnPath(value: string | undefined) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, "http://localhost");
    const pathWithSearch = `${url.pathname}${url.search}`;
    if (url.pathname !== "/parent" && !url.pathname.startsWith("/parent/")) {
      return null;
    }
    return pathWithSearch;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let paymentIntentId: Types.ObjectId | null = null;

  try {
    const ctx = await requireParent();
    await connectToDatabase();

    const body = BodySchema.parse(await req.json());
    if (!Types.ObjectId.isValid(body.studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student id." },
        { status: 400 }
      );
    }

    const studentId = new Types.ObjectId(body.studentId);
    const [guardian, student, eligibility, settings, account, currentPeriod] =
      await Promise.all([
        Guardian.findOne({ userId: ctx.userId, studentId }).select("_id").lean(),
        Student.findOne({ _id: studentId, schoolId: ctx.schoolId })
          .select("_id schoolId status gradeId classGroupId")
          .lean<StudentRow | null>(),
        getSchoolLearnEligibility(ctx.schoolId),
        getOrCreateLearnPlatformSettings(),
        LearnStudentAccount.findOne({ schoolId: ctx.schoolId, studentId })
          .select("_id status")
          .lean<AccountRow | null>(),
        AcademicPeriod.findOne({ schoolId: ctx.schoolId, isCurrent: true })
          .select("_id endDate")
          .lean<PeriodRow | null>(),
      ]);

    if (!guardian) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this student." },
        { status: 403 }
      );
    }
    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found." },
        { status: 404 }
      );
    }
    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          success: false,
          error: eligibility.reason || "This school is not eligible for EduSentrix Learn.",
        },
        { status: 409 }
      );
    }
    if (student.status !== "active" || !student.gradeId || !student.classGroupId) {
      return NextResponse.json(
        {
          success: false,
          error: "This student needs active status, grade, and class placement first.",
        },
        { status: 409 }
      );
    }
    if (!account || account.status === "disabled") {
      return NextResponse.json(
        {
          success: false,
          error: "The school must create a Learn account for this student before payment.",
        },
        { status: 409 }
      );
    }

    const existingAccess = await LearnAccess.findOne({
      schoolId: ctx.schoolId,
      studentId,
      status: "active",
      expiresAt: { $gt: new Date() },
    })
      .select("_id expiresAt")
      .lean<{ _id: Types.ObjectId; expiresAt: Date } | null>();
    if (existingAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "This student already has active Learn access.",
          data: {
            accessId: String(existingAccess._id),
            expiresAt: existingAccess.expiresAt.toISOString(),
          },
        },
        { status: 409 }
      );
    }

    const amountMinor = Math.max(
      0,
      Math.round(Number(settings.pricePerStudentPerTermMinor || 0))
    );
    if (amountMinor <= 0) {
      return NextResponse.json(
        { success: false, error: "EduSentrix Learn pricing is not configured." },
        { status: 409 }
      );
    }

    if (body.preview) {
      return NextResponse.json({
        success: true,
        data: {
          studentId: String(studentId),
          amountMinor,
          currency: settings.currency,
          paystackKeyMode: getPaystackKeyMode(),
        },
      });
    }

    const user = await User.findById(ctx.userId).select("email").lean<{ email?: string } | null>();
    if (!user?.email) {
      return NextResponse.json(
        { success: false, error: "Your account needs an email address for checkout." },
        { status: 400 }
      );
    }

    const paymentIntent = await LearnPaymentIntent.create({
      schoolId: ctx.schoolId,
      studentId,
      parentUserId: ctx.userId,
      accountId: account._id,
      academicPeriodId: currentPeriod?._id || null,
      amountMinor,
      currency: settings.currency,
      status: "initiated",
      paymentMethod: "paystack",
      idempotencyKey: randomUUID(),
      initiatedAt: new Date(),
    });
    paymentIntentId = paymentIntent._id as Types.ObjectId;

    const appUrl = getAppUrl().replace(/\/$/, "");
    const callbackPath =
      normalizeParentReturnPath(body.returnPath) ||
      `/parent/learn/wards/${String(studentId)}`;
    const callbackUrlObject = new URL(callbackPath, appUrl);
    callbackUrlObject.searchParams.set("checkout", "learn-paystack");
    const reference = `EDSX-LEARN-${String(paymentIntent._id)}-${Date.now()}`;

    try {
      const init = await initializeTransaction({
        email: user.email,
        amountMinor,
        reference,
        callbackUrl: callbackUrlObject.toString(),
        currency: settings.currency,
        metadata: {
          type: "learn_access",
          schoolId: String(ctx.schoolId),
          studentId: String(studentId),
          parentUserId: String(ctx.userId),
          accountId: String(account._id),
          paymentIntentId: String(paymentIntent._id),
          academicPeriodId: currentPeriod?._id ? String(currentPeriod._id) : null,
        },
      });

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await LearnPaymentIntent.findByIdAndUpdate(paymentIntent._id, {
        $set: {
          status: "awaiting_webhook",
          paystackReference: init.reference,
          expiresAt,
          failureReason: null,
        },
      });

      await AuditEvent.create({
        scopeType: "school",
        scopeId: ctx.schoolId,
        domain: "billing",
        tier: 1,
        actionCode: "learn.payment.initiated",
        result: "succeeded",
        occurredAt: new Date(),
        actorType: "user",
        actorId: ctx.userId,
        targetEntityType: "LearnPaymentIntent",
        targetEntityId: paymentIntent._id,
        secondaryEntityType: "Student",
        secondaryEntityId: studentId,
        metadata: {
          amountMinor,
          currency: settings.currency,
          paystackReference: init.reference,
        },
        sensitivity: "moderate",
        redactionMode: "masked",
        retentionClass: "financial_critical",
      });

      return NextResponse.json({
        success: true,
        data: {
          authorizationUrl: init.authorization_url,
          reference: init.reference,
          amountMinor,
          currency: settings.currency,
          studentId: String(studentId),
          paymentIntentId: String(paymentIntent._id),
          expiresAt: expiresAt.toISOString(),
          paystackKeyMode: getPaystackKeyMode(),
        },
      });
    } catch (initError) {
      const message =
        initError instanceof Error ? initError.message : "Learn checkout failed.";
      await LearnPaymentIntent.findByIdAndUpdate(paymentIntent._id, {
        $set: { status: "failed", failureReason: message },
      });
      throw initError;
    }
  } catch (error) {
    if (error instanceof NextResponse) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid Learn checkout payload." },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to initialize Learn checkout.";
    console.error("[parent/learn/payments/initiate:POST]", error);

    if (paymentIntentId) {
      await LearnPaymentIntent.findByIdAndUpdate(paymentIntentId, {
        $set: { status: "failed", failureReason: message },
      }).catch(() => undefined);
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
