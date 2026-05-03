import mongoose from "mongoose";
import { z } from "zod";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import {
  getInternalTestImpersonationSecret,
  INTERNAL_TEST_IMPERSONATION_COOKIE,
} from "@/lib/internal-test/impersonation-secret";
import { signImpersonationPayload } from "@/lib/internal-test/impersonation-token";
import { writePlatformAuditLog } from "@/lib/internal-test/write-audit";
import { InternalTestSchoolConfig } from "@/models/InternalTestSchoolConfig";
import { School } from "@/models/School";
import { User } from "@/models/User";

const BodySchema = z.object({
  targetUserId: z.string().min(1),
});

function suggestRedirectForTestUser(role?: string | null): string {
  switch (role) {
    case "teacher":
      return "/teacher";
    case "parent":
      return "/parent";
    case "student":
      return "/student";
    case "bursar":
    case "billing_owner":
    case "staff":
    case "school_admin":
    default:
      return "/admin";
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformInternalTestAccess();
    if (!gate.ok) return gate.res;

    const secret = getInternalTestImpersonationSecret();
    if (!secret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Impersonation secret is not configured. Set INTERNAL_TEST_IMPERSONATION_SECRET or INTERNAL_TEST_ACTIVATION_SECRET.",
          code: "IMPERSONATION_SECRET_MISSING",
        },
        { status: 503 }
      );
    }

    const { id: schoolIdParam } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(schoolIdParam)) {
      return NextResponse.json({ success: false, error: "Invalid school id" }, { status: 400 });
    }
    const schoolId = new mongoose.Types.ObjectId(schoolIdParam);

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "targetUserId required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(parsed.data.targetUserId)) {
      return NextResponse.json({ success: false, error: "Invalid target user id" }, { status: 400 });
    }

    await connectToDatabase();

    const [school, config, target] = await Promise.all([
      School.findById(schoolId).select("isInternalTestSchool internalTest").lean(),
      InternalTestSchoolConfig.findOne({ schoolId }).lean(),
      User.findById(parsed.data.targetUserId).lean(),
    ]);

    if (!school?.isInternalTestSchool || !school.internalTest?.enabled) {
      return NextResponse.json(
        { success: false, error: "School is not in internal test mode." },
        { status: 409 }
      );
    }
    if (!config?.allowImpersonation) {
      return NextResponse.json(
        { success: false, error: "Impersonation is disabled for this school.", code: "IMPERSONATION_DISABLED" },
        { status: 403 }
      );
    }

    if (!target || !target.isTestUser || String(target.schoolId) !== String(schoolId)) {
      return NextResponse.json(
        { success: false, error: "Target must be a test user in this school." },
        { status: 400 }
      );
    }

    const { auth } = await import("@clerk/nextjs/server");
    const { userId: actorClerkId } = await auth();
    if (!actorClerkId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
    const token = signImpersonationPayload(secret, {
      v: 1,
      actorClerkId,
      targetUserId: String(target._id),
      schoolId: String(schoolId),
      exp,
    });

    const jar = await cookies();
    jar.set(INTERNAL_TEST_IMPERSONATION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60,
    });

    await writePlatformAuditLog({
      actorId: gate.me._id,
      schoolId,
      action: "internal_test.impersonation_started",
      entityType: "User",
      entityId: target._id as mongoose.Types.ObjectId,
      metadata: {
        targetUserId: String(target._id),
        targetRole: target.role,
        actorClerkUserId: actorClerkId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        redirectPath: suggestRedirectForTestUser(target.role),
        target: {
          id: String(target._id),
          email: target.email,
          role: target.role,
          firstName: target.firstName,
          lastName: target.lastName,
        },
      },
    });
  } catch (e) {
    console.error("internal-test impersonate POST", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to start impersonation" },
      { status: 500 }
    );
  }
}
