import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileSettings, patchMobileSettings } from "@/lib/learn/mobile-settings";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const PatchSchema = z
  .object({
    notificationsEnabled: z.boolean().optional(),
    dailyReminderEnabled: z.boolean().optional(),
    dailyReminderTime: z.string().trim().optional(),
    soundEffectsEnabled: z.boolean().optional(),
    reducedMotionEnabled: z.boolean().optional(),
    dailyGoalMinutes: z.number().int().min(5).max(120).optional(),
    offlineDownloadsEnabled: z.boolean().optional(),
    leoTutorHintsFirst: z.boolean().optional(),
    leoReadAloudEnabled: z.boolean().optional(),
    leoReadAloudEnabled: z.boolean().optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await requireLearnMobileStudent(request);
  if (!auth.ok) return auth.response;

  const result = await buildMobileSettings(auth.context);

  if (!result.ok) {
    return mobileApiFailure({
      code: result.code,
      message: result.message,
      status: result.status,
    });
  }

  return mobileApiSuccess(result.data);
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = PatchSchema.parse(await request.json());
    const result = await patchMobileSettings(auth.context, body);

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid settings update.",
        status: 400,
      });
    }
    console.error("[learn/mobile/settings]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Settings update failed.", status: 500 });
  }
}
