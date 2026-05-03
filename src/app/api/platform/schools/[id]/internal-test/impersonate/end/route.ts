import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import {
  getInternalTestImpersonationSecret,
  INTERNAL_TEST_IMPERSONATION_COOKIE,
} from "@/lib/internal-test/impersonation-secret";
import { verifyImpersonationToken } from "@/lib/internal-test/impersonation-token";
import { writePlatformAuditLog } from "@/lib/internal-test/write-audit";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformInternalTestAccess();
    if (!gate.ok) return gate.res;

    const { id: schoolIdParam } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(schoolIdParam)) {
      return NextResponse.json({ success: false, error: "Invalid school id" }, { status: 400 });
    }
    const schoolId = new mongoose.Types.ObjectId(schoolIdParam);

    const secret = getInternalTestImpersonationSecret();
    const jar = await cookies();
    const raw = jar.get(INTERNAL_TEST_IMPERSONATION_COOKIE)?.value;

    const { userId: clerkUserId } = await auth();
    let hadSession = false;
    if (secret && raw && clerkUserId) {
      const v = verifyImpersonationToken(secret, raw);
      hadSession = Boolean(v && v.actorClerkId === clerkUserId && v.schoolId === String(schoolId));
    }

    jar.delete(INTERNAL_TEST_IMPERSONATION_COOKIE);

    if (hadSession) {
      await connectToDatabase();
      await writePlatformAuditLog({
        actorId: gate.me._id,
        schoolId,
        action: "internal_test.impersonation_ended",
        entityType: "School",
        entityId: schoolId,
        metadata: {},
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("internal-test impersonate end POST", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to end session" },
      { status: 500 }
    );
  }
}
