import mongoose from "mongoose";
import { LibrarySettings, type ILibrarySettings } from "@/models/LibrarySettings";
import { DEFAULT_LIBRARY_SETTINGS } from "@/lib/library/library.constants";
import type { z } from "zod";
import type { patchLibrarySettingsSchema } from "@/lib/library/library.validators";

type Patch = z.infer<typeof patchLibrarySettingsSchema>;

export async function getOrCreateLibrarySettings(
  schoolId: mongoose.Types.ObjectId
): Promise<ILibrarySettings> {
  let doc = await LibrarySettings.findOne({ schoolId }).lean<ILibrarySettings | null>();
  if (doc) return doc;

  const created = await LibrarySettings.create({
    schoolId,
    ...DEFAULT_LIBRARY_SETTINGS,
  });
  return created.toObject() as ILibrarySettings;
}

export async function patchLibrarySettingsDb(
  schoolId: mongoose.Types.ObjectId,
  patch: Patch
): Promise<ILibrarySettings> {
  await getOrCreateLibrarySettings(schoolId);
  const updated = await LibrarySettings.findOneAndUpdate(
    { schoolId },
    { $set: patch },
    { new: true, runValidators: true }
  ).lean<ILibrarySettings | null>();

  if (!updated) {
    throw new Error("Library settings not found after upsert");
  }
  return updated;
}
