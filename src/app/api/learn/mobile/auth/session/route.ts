import { NextRequest } from "next/server";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";
import { findActiveLearnMobileSession } from "@/lib/learn/mobile-session";

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request, { allowPasswordChangeOnly: true });
  if (!auth.ok) return auth.response;

  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const rawToken = match?.[1]?.trim();
  if (!rawToken) {
    return mobileApiFailure({
      code: "UNAUTHENTICATED",
      message: "Missing token.",
      status: 401,
    });
  }

  const session = await findActiveLearnMobileSession(rawToken);
  if (!session?.expiresAt) {
    return mobileApiFailure({
      code: "UNAUTHENTICATED",
      message: "Session not found.",
      status: 401,
    });
  }

  return mobileApiSuccess({
    isAuthenticated: !auth.context.mustChangePassword,
    userId: String(auth.context.studentId),
    studentId: String(auth.context.studentId),
    schoolId: String(auth.context.schoolId),
    accessToken: rawToken,
    expiresAt: session.expiresAt.toISOString(),
    mustChangePassword: auth.context.mustChangePassword,
  });
}
