import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { mobileApiFailure } from "@/lib/learn/mobile-api-response";
import { findActiveLearnMobileSession } from "@/lib/learn/mobile-session";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Student } from "@/models/Student";

export type LearnMobileStudentContext = {
  accountId: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  schoolId: Types.ObjectId;
  gradeId: Types.ObjectId | null;
  classGroupId: Types.ObjectId | null;
  mustChangePassword: boolean;
};

function readBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireLearnMobileStudent(
  request: NextRequest,
  options?: { allowPasswordChangeOnly?: boolean }
): Promise<
  | { ok: true; context: LearnMobileStudentContext }
  | { ok: false; response: ReturnType<typeof mobileApiFailure> }
> {
  const rawToken = readBearerToken(request);
  if (!rawToken) {
    return {
      ok: false,
      response: mobileApiFailure({
        code: "UNAUTHENTICATED",
        message: "Missing authorization token.",
        friendlyMessage: "Please sign in again to continue learning.",
        status: 401,
      }),
    };
  }

  const session = await findActiveLearnMobileSession(rawToken);
  if (!session?.tokenHash) {
    return {
      ok: false,
      response: mobileApiFailure({
        code: "UNAUTHENTICATED",
        message: "Invalid or expired session.",
        friendlyMessage: "Please sign in again to continue learning.",
        status: 401,
      }),
    };
  }

  await connectToDatabase();

  const [account, student] = await Promise.all([
    LearnStudentAccount.findById(session.accountId)
      .select("_id schoolId studentId status mustChangePassword")
      .lean<{
        _id: Types.ObjectId;
        schoolId: Types.ObjectId;
        studentId: Types.ObjectId;
        status: string;
        mustChangePassword: boolean;
      } | null>(),
    Student.findOne({ _id: session.studentId, schoolId: session.schoolId })
      .select("_id schoolId status gradeId classGroupId")
      .lean<{
        _id: Types.ObjectId;
        schoolId: Types.ObjectId;
        status: string;
        gradeId?: Types.ObjectId | null;
        classGroupId?: Types.ObjectId | null;
      } | null>(),
  ]);

  if (!account || !student) {
    return {
      ok: false,
      response: mobileApiFailure({
        code: "NO_STUDENT_PROFILE",
        message: "Student profile not found.",
        friendlyMessage: "We could not find your student profile yet.",
        status: 404,
      }),
    };
  }

  if (account.status === "locked") {
    return {
      ok: false,
      response: mobileApiFailure({
        code: "ACCOUNT_LOCKED",
        message: "Learn account is locked.",
        friendlyMessage: "Your account is locked for now. Please ask your school administrator.",
        status: 403,
      }),
    };
  }

  if (account.status === "disabled") {
    return {
      ok: false,
      response: mobileApiFailure({
        code: "ACCOUNT_DISABLED",
        message: "Learn account is disabled.",
        friendlyMessage: "Your Learn account is not active. Please contact your school.",
        status: 403,
      }),
    };
  }

  if (student.status !== "active") {
    return {
      ok: false,
      response: mobileApiFailure({
        code: "NO_STUDENT_PROFILE",
        message: "Student is not active.",
        friendlyMessage: "We could not find your active student profile.",
        status: 403,
      }),
    };
  }

  if (account.mustChangePassword && !options?.allowPasswordChangeOnly) {
    return {
      ok: false,
      response: mobileApiFailure({
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Password change is required.",
        friendlyMessage: "Please set a new password before continuing.",
        status: 403,
      }),
    };
  }

  return {
    ok: true,
    context: {
      accountId: account._id,
      sessionId: session._id,
      studentId: student._id,
      schoolId: student.schoolId,
      gradeId: student.gradeId ?? null,
      classGroupId: student.classGroupId ?? null,
      mustChangePassword: account.mustChangePassword,
    },
  };
}

export function getRequestMeta(request: NextRequest) {
  return {
    userAgent: request.headers.get("user-agent"),
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null,
  };
}
