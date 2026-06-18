import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { isDatabaseConnectionError } from "@/lib/api/database-errors";
import { verifyLearnPassword } from "@/lib/learn/account-credentials";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import { getRequestMeta } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import {
  createLearnMobileSession,
  learnMobileSessionExpiresAt,
  learnMobileTempSessionExpiresAt,
} from "@/lib/learn/mobile-session";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { getSchoolLearnEligibility } from "@/lib/learn/eligibility";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { School } from "@/models/School";
import { Student } from "@/models/Student";

const BodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  deviceName: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = BodySchema.parse(await request.json());
    const username = body.username.trim().toLowerCase();
    const meta = getRequestMeta(request);

    await connectToDatabase();

    const account = await LearnStudentAccount.findOne({ username })
      .select("+passwordHash")
      .lean<{
        _id: import("mongoose").Types.ObjectId;
        schoolId: import("mongoose").Types.ObjectId;
        studentId: import("mongoose").Types.ObjectId;
        passwordHash: string;
        status: string;
        mustChangePassword: boolean;
      } | null>();

    if (!account) {
      return mobileApiFailure({
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password.",
        friendlyMessage: "That username or password does not look right. Please try again.",
        status: 401,
      });
    }

    if (account.status === "locked") {
      return mobileApiFailure({
        code: "ACCOUNT_LOCKED",
        message: "Learn account is locked.",
        friendlyMessage: "Your account is locked for now. Please ask your school administrator.",
        status: 403,
      });
    }

    if (account.status === "disabled") {
      return mobileApiFailure({
        code: "ACCOUNT_DISABLED",
        message: "Learn account is disabled.",
        friendlyMessage: "Your Learn account is not active. Please contact your school.",
        status: 403,
      });
    }

    const passwordValid = await verifyLearnPassword(body.password, account.passwordHash);
    if (!passwordValid) {
      return mobileApiFailure({
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password.",
        friendlyMessage: "That username or password does not look right. Please try again.",
        status: 401,
      });
    }

    const [student, school, schoolEligibility] = await Promise.all([
      Student.findOne({ _id: account.studentId, schoolId: account.schoolId })
        .select("_id firstName schoolId status gradeId classGroupId")
        .lean<{
          _id: import("mongoose").Types.ObjectId;
          firstName: string;
          schoolId: import("mongoose").Types.ObjectId;
          status: string;
          gradeId?: import("mongoose").Types.ObjectId | null;
          classGroupId?: import("mongoose").Types.ObjectId | null;
        } | null>(),
      School.findById(account.schoolId).select("name").lean<{ name: string } | null>(),
      getSchoolLearnEligibility(account.schoolId),
    ]);

    if (!student || student.status !== "active") {
      return mobileApiFailure({
        code: "NO_STUDENT_PROFILE",
        message: "Active student profile not found.",
        friendlyMessage: "We could not find your student profile yet.",
        status: 404,
      });
    }

    if (!schoolEligibility.eligible) {
      return mobileApiFailure({
        code: "SCHOOL_NOT_ELIGIBLE",
        message: schoolEligibility.reason || "School is not eligible for EduSentrix Learn.",
        friendlyMessage:
          schoolEligibility.reason ||
          "Your school is not set up for EduSentrix Learn yet.",
        status: 403,
      });
    }

    const expiresAt = account.mustChangePassword
      ? learnMobileTempSessionExpiresAt()
      : learnMobileSessionExpiresAt();

    const { accessToken, session } = await createLearnMobileSession({
      schoolId: account.schoolId,
      studentId: account.studentId,
      accountId: account._id,
      expiresAt,
      deviceName: body.deviceName,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    await LearnStudentAccount.updateOne(
      { _id: account._id },
      { $set: { lastLoginAt: new Date() } }
    );

    if (account.mustChangePassword) {
      return mobileApiSuccess({
        requiresPasswordChange: true as const,
        tempSessionToken: accessToken,
        studentPreview: {
          firstName: student.firstName,
          schoolName: school?.name || "Your school",
        },
      });
    }

    const bundle = await loadMobileStudentBundle({
      studentId: account.studentId,
      schoolId: account.schoolId,
      accountId: account._id,
    });

    if (!bundle) {
      return mobileApiFailure({
        code: "NO_STUDENT_PROFILE",
        message: "Could not load student profile.",
        status: 500,
      });
    }

    await recordLearnMobileActivity({
      schoolId: account.schoolId,
      studentId: account.studentId,
      accountId: account._id,
      gradeId: student.gradeId ?? null,
      classGroupId: student.classGroupId ?? null,
      eventType: "login",
      metadata: { sessionId: String(session._id) },
    });

    return mobileApiSuccess({
      accessToken,
      expiresAt: expiresAt.toISOString(),
      student: serializeMobileLoginStudent(bundle),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid login request.",
        friendlyMessage: "Please enter your username and password.",
        status: 400,
        details: error.flatten(),
      });
    }

    if (isDatabaseConnectionError(error)) {
      console.error("[learn/mobile/auth/login] database unavailable", error);
      return mobileApiFailure({
        code: "DATABASE_UNAVAILABLE",
        message: "Database connection is unavailable.",
        friendlyMessage:
          "EduSentrix Learn cannot reach the school database right now. Please try again shortly.",
        status: 503,
      });
    }

    console.error("[learn/mobile/auth/login]", error);
    return mobileApiFailure({
      code: "UNKNOWN_ERROR",
      message: "Login failed.",
      friendlyMessage: "Something went wrong. Please try again.",
      status: 500,
    });
  }
}
