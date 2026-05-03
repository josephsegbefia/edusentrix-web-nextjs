import mongoose from "mongoose";
import { z } from "zod";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import { PHRASE_ENABLE_TEST_SCHOOL } from "@/lib/internal-test/constants";
import { buildDefaultInternalTestSchoolConfig } from "@/lib/internal-test/default-config";
import { isActivationSecretConfigured, isValidInternalTestActivationSecret } from "@/lib/internal-test/verify-activation-secret";
import { writePlatformAuditLog } from "@/lib/internal-test/write-audit";
import { School } from "@/models/School";
import { InternalTestSchoolConfig } from "@/models/InternalTestSchoolConfig";

const BodySchema = z.object({
  mode: z.enum(["manual", "seeded", "manual_and_seeded"]),
  confirmationPhrase: z.string().min(1),
  activationSecret: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
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

    if (parsed.data.confirmationPhrase.trim() !== PHRASE_ENABLE_TEST_SCHOOL) {
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
            "INTERNAL_TEST_ACTIVATION_SECRET is not configured on the server. Set it before enabling test mode.",
          code: "ACTIVATION_SECRET_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    if (!isValidInternalTestActivationSecret(parsed.data.activationSecret)) {
      await writePlatformAuditLog({
        actorId: gate.me._id,
        schoolId,
        action: "internal_test.activate_rejected",
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

    const existing = await School.findById(schoolId)
      .select("name isInternalTestSchool environmentType internalTest")
      .lean();
    if (!existing) {
      return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
    }

    if (existing.isInternalTestSchool && existing.internalTest?.enabled) {
      return NextResponse.json(
        { success: false, error: "This school is already in internal test mode." },
        { status: 409 }
      );
    }

    const now = new Date();
    await School.findByIdAndUpdate(schoolId, {
      $set: {
        environmentType: "internal_test",
        isInternalTestSchool: true,
        internalTest: {
          enabled: true,
          enabledAt: now,
          enabledBy: gate.me._id,
          disabledAt: null,
          disabledBy: null,
          mode: parsed.data.mode,
          visibleBadgeEnabled: true,
          notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
        },
      },
    });

    const defaults = buildDefaultInternalTestSchoolConfig(schoolId, gate.me._id);
    await InternalTestSchoolConfig.updateOne({ schoolId }, { $set: defaults }, { upsert: true });

    await writePlatformAuditLog({
      actorId: gate.me._id,
      schoolId,
      action: "internal_test.enabled",
      entityType: "School",
      entityId: schoolId,
      metadata: {
        mode: parsed.data.mode,
        notes: parsed.data.notes ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        schoolId: schoolIdParam,
        environmentType: "internal_test" as const,
      },
    });
  } catch (error: unknown) {
    console.error("internal-test activate:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to activate internal test mode",
      },
      { status: 500 }
    );
  }
}
