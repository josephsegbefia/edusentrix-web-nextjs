import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import {
  getOrCreateLearnPlatformSettings,
  serializeLearnPlatformSettings,
} from "@/lib/learn/platform-settings";
import { LearnPlatformSettings } from "@/models/LearnPlatformSettings";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";

const UpdateLearnSettingsSchema = z.object({
  pricePerStudentPerTermMinor: z.number().int().min(0).max(100000000),
  allowPlatformGifts: z.boolean(),
  starterPlanBlocked: z.boolean(),
  disabled: z.boolean(),
});

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  return Object.keys(after).filter((key) => before[key] !== after[key]);
}

export async function GET() {
  try {
    const gate = await requirePlatformPermission("platform.learn.read");
    if (!gate.ok) return gate.res;

    const settings = await getOrCreateLearnPlatformSettings(gate.actor.userId);

    return NextResponse.json({
      success: true,
      data: serializeLearnPlatformSettings(settings),
    });
  } catch (error) {
    console.error("[platform/learn/settings:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load EduSentrix Learn settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.learn.pricing.manage");
    if (!gate.ok) return gate.res;

    const parsed = UpdateLearnSettingsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid EduSentrix Learn settings payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const current = await getOrCreateLearnPlatformSettings(gate.actor.userId);
    const before = serializeLearnPlatformSettings(current);
    const input = parsed.data;

    const updated = await LearnPlatformSettings.findByIdAndUpdate(
      current._id,
      {
        $set: {
          pricePerStudentPerTermMinor: input.pricePerStudentPerTermMinor,
          allowPlatformGifts: input.allowPlatformGifts,
          starterPlanBlocked: input.starterPlanBlocked,
          disabled: input.disabled,
          updatedBy: gate.actor.userId,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "EduSentrix Learn settings were not found." },
        { status: 404 }
      );
    }

    const after = serializeLearnPlatformSettings(updated);
    const changed = changedFields(before, after);

    await PlatformAuditLog.create({
      actorId: gate.actor.userId,
      action: "platform.learn.settings_updated",
      entityType: "LearnPlatformSettings",
      entityId: updated._id,
      metadata: {
        changedFields: changed,
        before: {
          pricePerStudentPerTermMinor: before.pricePerStudentPerTermMinor,
          allowPlatformGifts: before.allowPlatformGifts,
          starterPlanBlocked: before.starterPlanBlocked,
          disabled: before.disabled,
        },
        after: {
          pricePerStudentPerTermMinor: after.pricePerStudentPerTermMinor,
          allowPlatformGifts: after.allowPlatformGifts,
          starterPlanBlocked: after.starterPlanBlocked,
          disabled: after.disabled,
        },
      },
    });

    return NextResponse.json({ success: true, data: after });
  } catch (error) {
    console.error("[platform/learn/settings:PATCH]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update EduSentrix Learn settings." },
      { status: 500 }
    );
  }
}
