import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  hashLearnPassword,
  verifyLearnPassword,
} from "@/lib/learn/account-credentials";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import {
  createLearnMobileSession,
  learnMobileSessionExpiresAt,
  revokeLearnMobileSession,
} from "@/lib/learn/mobile-session";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";

const BodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request, { allowPasswordChangeOnly: true });
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());

    await connectToDatabase();

    const account = await LearnStudentAccount.findById(auth.context.accountId)
      .select("+passwordHash status mustChangePassword")
      .lean<{
        _id: import("mongoose").Types.ObjectId;
        passwordHash: string;
        status: string;
        mustChangePassword: boolean;
      } | null>();

    if (!account) {
      return mobileApiFailure({
        code: "NO_STUDENT_PROFILE",
        message: "Account not found.",
        status: 404,
      });
    }

    const currentValid = await verifyLearnPassword(body.currentPassword, account.passwordHash);
    if (!currentValid) {
      return mobileApiFailure({
        code: "INVALID_CREDENTIALS",
        message: "Current password is incorrect.",
        friendlyMessage: "Your current password does not look right.",
        status: 401,
      });
    }

    const passwordHash = await hashLearnPassword(body.newPassword);

    await LearnStudentAccount.updateOne(
      { _id: account._id },
      {
        $set: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          status: account.status === "pending_first_login" ? "active" : account.status,
        },
      }
    );

    await revokeLearnMobileSession(auth.context.sessionId);

    const expiresAt = learnMobileSessionExpiresAt();
    const { accessToken } = await createLearnMobileSession({
      schoolId: auth.context.schoolId,
      studentId: auth.context.studentId,
      accountId: auth.context.accountId,
      expiresAt,
    });

    const bundle = await loadMobileStudentBundle({
      studentId: auth.context.studentId,
      schoolId: auth.context.schoolId,
      accountId: auth.context.accountId,
    });

    if (!bundle) {
      return mobileApiFailure({
        code: "NO_STUDENT_PROFILE",
        message: "Could not load student profile.",
        status: 500,
      });
    }

    await recordLearnMobileActivity({
      schoolId: auth.context.schoolId,
      studentId: auth.context.studentId,
      accountId: auth.context.accountId,
      gradeId: auth.context.gradeId,
      classGroupId: auth.context.classGroupId,
      eventType: "login",
      metadata: { passwordChanged: true },
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
        message: "Invalid password request.",
        friendlyMessage: "Choose a stronger password (at least 8 characters).",
        status: 400,
        details: error.flatten(),
      });
    }

    console.error("[learn/mobile/auth/change-password]", error);
    return mobileApiFailure({
      code: "UNKNOWN_ERROR",
      message: "Password change failed.",
      status: 500,
    });
  }
}
