import mongoose from "mongoose";
import { z } from "zod";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import { writePlatformAuditLog } from "@/lib/internal-test/write-audit";
import {
  serializeInternalTestSchoolConfig,
  serializeInternalTestSchoolSummary,
} from "@/lib/internal-test/serialize-config";
import { School } from "@/models/School";
import { InternalTestSchoolConfig } from "@/models/InternalTestSchoolConfig";
import type { ISchool } from "@/models/School";

const PatchSchema = z.object({
  suppressEmailInvitations: z.boolean().optional(),
  autoActivateCreatedUsers: z.boolean().optional(),
  markEmailsAsVerified: z.boolean().optional(),
  suppressSms: z.boolean().optional(),
  suppressWhatsapp: z.boolean().optional(),
  suppressPushNotifications: z.boolean().optional(),
  suppressParentNotifications: z.boolean().optional(),
  useSandboxPayments: z.boolean().optional(),
  disableRealPaymentCollection: z.boolean().optional(),
  allowImpersonation: z.boolean().optional(),
  showInternalTestBadge: z.boolean().optional(),
  allowSeedGeneration: z.boolean().optional(),
  allowResetGeneratedData: z.boolean().optional(),
});

export async function GET(
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

    await connectToDatabase();

    const school = await School.findById(schoolId).lean<ISchool | null>();
    if (!school) {
      return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
    }

    const configDoc = await InternalTestSchoolConfig.findOne({ schoolId }).lean();

    return NextResponse.json({
      success: true,
      data: {
        school: serializeInternalTestSchoolSummary(school),
        config: configDoc ? serializeInternalTestSchoolConfig(configDoc) : null,
      },
    });
  } catch (error: unknown) {
    console.error("internal-test config GET:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load config",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates = {
      ...parsed.data,
      allowSeedGeneration: false,
      allowResetGeneratedData: false,
    };
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ success: false, error: "No fields to update." }, { status: 400 });
    }

    await connectToDatabase();

    const school = await School.findById(schoolId).select("isInternalTestSchool internalTest").lean();
    if (!school?.isInternalTestSchool || !school.internalTest?.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: "Internal test mode must be enabled before updating configuration.",
        },
        { status: 409 }
      );
    }

    const existing = await InternalTestSchoolConfig.findOne({ schoolId }).lean();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Internal test configuration not found." },
        { status: 404 }
      );
    }

    const previous = { ...existing };

    const updatedDoc = await InternalTestSchoolConfig.findOneAndUpdate(
      { schoolId },
      { $set: { ...updates, updatedBy: gate.me._id } },
      { new: true }
    ).lean();

    if (!updatedDoc) {
      return NextResponse.json({ success: false, error: "Failed to update configuration." }, { status: 500 });
    }

    if (updates.showInternalTestBadge !== undefined) {
      await School.findByIdAndUpdate(schoolId, {
        $set: {
          "internalTest.visibleBadgeEnabled": updates.showInternalTestBadge,
        },
      });
    }

    await writePlatformAuditLog({
      actorId: gate.me._id,
      schoolId,
      action: "internal_test.config_updated",
      entityType: "InternalTestSchoolConfig",
      entityId: updatedDoc._id,
      metadata: {
        changedKeys: Object.keys(parsed.data),
        previous: Object.fromEntries(
          Object.keys(parsed.data).map((k) => [k, (previous as Record<string, unknown>)[k]])
        ),
        next: updates,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        config: serializeInternalTestSchoolConfig(updatedDoc),
      },
    });
  } catch (error: unknown) {
    console.error("internal-test config PATCH:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update config",
      },
      { status: 500 }
    );
  }
}
