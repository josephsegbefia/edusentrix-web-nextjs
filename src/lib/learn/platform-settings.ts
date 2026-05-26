import type { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  LearnPlatformSettings,
  type ILearnPlatformSettings,
} from "@/models/LearnPlatformSettings";

export const LEARN_PLATFORM_SETTINGS_KEY = "learn_platform_settings" as const;

export type SerializedLearnPlatformSettings = {
  id: string;
  pricePerStudentPerTermMinor: number;
  currency: "GHS";
  allowPlatformGifts: boolean;
  defaultAccessDuration: "term";
  starterPlanBlocked: boolean;
  disabled: boolean;
  updatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export function serializeLearnPlatformSettings(
  settings: ILearnPlatformSettings
): SerializedLearnPlatformSettings {
  return {
    id: String(settings._id),
    pricePerStudentPerTermMinor: Math.max(
      0,
      Math.round(Number(settings.pricePerStudentPerTermMinor || 0))
    ),
    currency: settings.currency || "GHS",
    allowPlatformGifts: Boolean(settings.allowPlatformGifts),
    defaultAccessDuration: settings.defaultAccessDuration || "term",
    starterPlanBlocked: settings.starterPlanBlocked !== false,
    disabled: Boolean(settings.disabled),
    updatedBy: settings.updatedBy ? String(settings.updatedBy) : null,
    createdAt: settings.createdAt?.toISOString?.() || null,
    updatedAt: settings.updatedAt?.toISOString?.() || null,
  };
}

export async function getOrCreateLearnPlatformSettings(
  updatedBy?: Types.ObjectId | null
) {
  await connectToDatabase();

  return LearnPlatformSettings.findOneAndUpdate(
    { singletonKey: LEARN_PLATFORM_SETTINGS_KEY },
    {
      $setOnInsert: {
        singletonKey: LEARN_PLATFORM_SETTINGS_KEY,
        pricePerStudentPerTermMinor: 30000,
        currency: "GHS",
        allowPlatformGifts: true,
        defaultAccessDuration: "term",
        starterPlanBlocked: true,
        disabled: false,
        updatedBy: updatedBy || null,
      },
    },
    { new: true, upsert: true }
  );
}
