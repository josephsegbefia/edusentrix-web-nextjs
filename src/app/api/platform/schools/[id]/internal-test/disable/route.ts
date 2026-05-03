import mongoose from "mongoose";
import { z } from "zod";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import { PHRASE_DISABLE_TEST_SCHOOL } from "@/lib/internal-test/constants";
import { isActivationSecretConfigured, isValidInternalTestActivationSecret } from "@/lib/internal-test/verify-activation-secret";
import { writePlatformAuditLog } from "@/lib/internal-test/write-audit";
import { School } from "@/models/School";

const BodySchema = z.object({
  confirmationPhrase: z.string().min(1),
  activationSecret: z.string().min(1),
});

export async function POST(
  req: Request,
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

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.confirmationPhrase.trim() !== PHRASE_DISABLE_TEST_SCHOOL) {
      return NextResponse.json(
        { success: false, error: "Confirmation phrase does not match." },
        { status: 400 }
      );
    }

    if (!isActivationSecretConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INTERNAL_TEST_ACTIVATION_SECRET is not configured on the server.",
          code: "ACTIVATION_SECRET_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    if (!isValidInternalTestActivationSecret(parsed.data.activationSecret)) {
      await writePlatformAuditLog({
        actorId: gate.me._id,
        schoolId,
        action: "internal_test.disable_rejected",
        entityType: "School",
        entityId: schoolId,
        metadata: { reason: "invalid_activation_secret" },
      });
      return NextResponse.json(
        { success: false, error: "Invalid activation secret.", code: "INVALID_ACTIVATION_SECRET" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const existing = await School.findById(schoolId).select("isInternalTestSchool internalTest").lean();
    if (!existing) {
      return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
    }

    if (!existing.isInternalTestSchool || !existing.internalTest?.enabled) {
      return NextResponse.json(
        { success: false, error: "Internal test mode is not enabled for this school." },
        { status: 409 }
      );
    }

    const now = new Date();
    await School.findByIdAndUpdate(schoolId, {
      $set: {
        environmentType: "production",
        isInternalTestSchool: false,
        internalTest: {
          enabled: false,
          enabledAt: existing.internalTest?.enabledAt ?? null,
          enabledBy: existing.internalTest?.enabledBy ?? null,
          disabledAt: now,
          disabledBy: gate.me._id,
          mode: existing.internalTest?.mode ?? undefined,
          visibleBadgeEnabled: existing.internalTest?.visibleBadgeEnabled ?? false,
          notes: existing.internalTest?.notes ?? null,
        },
      },
    });

    await writePlatformAuditLog({
      actorId: gate.me._id,
      schoolId,
      action: "internal_test.disabled",
      entityType: "School",
      entityId: schoolId,
      metadata: {},
    });

    return NextResponse.json({
      success: true,
      data: {
        schoolId: schoolIdParam,
        environmentType: "production" as const,
      },
    });
  } catch (error: unknown) {
    console.error("internal-test disable:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to disable internal test mode",
      },
      { status: 500 }
    );
  }
}
