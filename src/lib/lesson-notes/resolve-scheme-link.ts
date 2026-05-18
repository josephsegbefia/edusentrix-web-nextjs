import mongoose from "mongoose";
import { LessonNote } from "@/models/LessonNote";
import { Lesson } from "@/models/Lesson";
import { SchemeOfWork } from "@/models/SchemeOfWork";

export type SchemeLinkFields = {
  schemeId: string | null;
  schemeItemIds: string[];
};

type ResolveSchemeLinkInput = {
  schoolId: mongoose.Types.ObjectId;
  schemeId: mongoose.Types.ObjectId | string | null | undefined;
  schemeItemIds?: (mongoose.Types.ObjectId | string)[] | null | undefined;
  repair?: {
    collection: "lessonNote" | "lesson";
    id: mongoose.Types.ObjectId;
  };
};

function toSchemeLinkStrings(input: {
  schemeId: mongoose.Types.ObjectId | string | null | undefined;
  schemeItemIds?: (mongoose.Types.ObjectId | string)[] | null | undefined;
}): SchemeLinkFields {
  return {
    schemeId: input.schemeId ? String(input.schemeId) : null,
    schemeItemIds: (input.schemeItemIds || []).map((id) => String(id)),
  };
}

/** Returns scheme link fields only when the scheme still exists; optionally clears stale DB refs. */
export async function resolveSchemeLinkForResponse(
  input: ResolveSchemeLinkInput,
): Promise<SchemeLinkFields> {
  const link = toSchemeLinkStrings(input);
  if (!link.schemeId) {
    return { schemeId: null, schemeItemIds: [] };
  }

  if (!mongoose.Types.ObjectId.isValid(link.schemeId)) {
    return clearOrphanedSchemeLink(input, { schemeId: null, schemeItemIds: [] });
  }

  const schemeOid = new mongoose.Types.ObjectId(link.schemeId);
  const exists = await SchemeOfWork.exists({ _id: schemeOid, schoolId: input.schoolId });
  if (exists) {
    return link;
  }

  return clearOrphanedSchemeLink(input, { schemeId: null, schemeItemIds: [] });
}

async function clearOrphanedSchemeLink(
  input: ResolveSchemeLinkInput,
  cleared: SchemeLinkFields,
): Promise<SchemeLinkFields> {
  if (!input.repair) {
    return cleared;
  }

  const Model = input.repair.collection === "lesson" ? Lesson : LessonNote;
  await Model.updateOne(
    { _id: input.repair.id, schoolId: input.schoolId },
    { $set: { schemeId: null, schemeItemIds: [] } },
  );

  return cleared;
}
