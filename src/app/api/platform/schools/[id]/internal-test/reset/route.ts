import mongoose from "mongoose";
import { z } from "zod";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import { PHRASE_RESET_TEST_DATA } from "@/lib/internal-test/constants";
import { deleteGeneratedBatch } from "@/lib/internal-test/generation/delete-generated-batch";
import { isActivationSecretConfigured, isValidInternalTestActivationSecret } from "@/lib/internal-test/verify-activation-secret";
import { writePlatformAuditLog } from "@/lib/internal-test/write-audit";
import { InternalTestGeneratedRecord } from "@/models/InternalTestGeneratedRecord";
import { InternalTestSchoolConfig } from "@/models/InternalTestSchoolConfig";
import { School } from "@/models/School";

const BodySchema = z.object({
  testDataBatchId: z.string().min(1),
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

    if (parsed.data.confirmationPhrase.trim() !== PHRASE_RESET_TEST_DATA) {
      return NextResponse.json(
        { success: false, error: "Confirmation phrase does not match (RESET TEST DATA)." },
        { status: 400 }
      );
    }

    if (!isActivationSecretConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "INTERNAL_TEST_ACTIVATION_SECRET is not configured on the server.",
          code: "ACTIVATION_SECRET_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    if (!isValidInternalTestActivationSecret(parsed.data.activationSecret)) {
      return NextResponse.json(
        { success: false, error: "Invalid activation secret.", code: "INVALID_ACTIVATION_SECRET" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const [school, config] = await Promise.all([
      School.findById(schoolId).select("isInternalTestSchool internalTest").lean(),
      InternalTestSchoolConfig.findOne({ schoolId }).lean(),
    ]);

    if (!school) {
      return NextResponse.json({ success: false, error: "School not found" }, { status: 404 });
    }
    if (!school.isInternalTestSchool || !school.internalTest?.enabled) {
      return NextResponse.json(
        { success: false, error: "Internal test mode is not enabled for this school." },
        { status: 409 }
      );
    }
    if (!config?.allowResetGeneratedData) {
      return NextResponse.json(
        {
          success: false,
          error: "Reset of generated data is disabled in configuration.",
          code: "RESET_DISABLED",
        },
        { status: 403 }
      );
    }

    const batchId = parsed.data.testDataBatchId.trim();
    const existing = await InternalTestGeneratedRecord.findOne({
      schoolId,
      testDataBatchId: batchId,
    })
      .select("_id")
      .lean();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "No generated records found for this batch id." },
        { status: 404 }
      );
    }

    await writePlatformAuditLog({
      actorId: gate.me._id,
      schoolId,
      action: "internal_test.reset_started",
      entityType: "InternalTestGeneratedRecord",
      metadata: { testDataBatchId: batchId },
    });

    try {
      const { deletedByCollection } = await deleteGeneratedBatch({
        schoolId,
        testDataBatchId: batchId,
      });

      await writePlatformAuditLog({
        actorId: gate.me._id,
        schoolId,
        action: "internal_test.reset_completed",
        entityType: "InternalTestGeneratedRecord",
        metadata: { testDataBatchId: batchId, deletedByCollection },
      });

      return NextResponse.json({
        success: true,
        data: { testDataBatchId: batchId, deletedByCollection },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await writePlatformAuditLog({
        actorId: gate.me._id,
        schoolId,
        action: "internal_test.reset_failed",
        entityType: "InternalTestGeneratedRecord",
        metadata: { testDataBatchId: batchId, error: message },
      });
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  } catch (e) {
    console.error("internal-test reset POST", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Reset failed" },
      { status: 500 }
    );
  }
}
