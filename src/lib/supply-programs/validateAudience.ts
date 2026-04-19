import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Student } from "@/models/Student";
import type { SupplyProgramAudienceMode } from "@/models/SupplyProgram";

export async function normalizeAudienceIds(
  schoolId: mongoose.Types.ObjectId,
  mode: SupplyProgramAudienceMode,
  rawIds: string[]
): Promise<mongoose.Types.ObjectId[]> {
  if (mode === "whole_school") {
    return [];
  }
  const unique = [...new Set(rawIds)].filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );
  if (unique.length === 0) {
    throw new Error("Select at least one target for this audience");
  }
  const oids = unique.map((id) => new mongoose.Types.ObjectId(id));

  if (mode === "grades") {
    const n = await Grade.countDocuments({
      _id: { $in: oids },
      schoolId,
    });
    if (n !== oids.length) throw new Error("One or more grades are invalid for this school");
    return oids;
  }
  if (mode === "class_groups") {
    const n = await ClassGroup.countDocuments({
      _id: { $in: oids },
      schoolId,
    });
    if (n !== oids.length) {
      throw new Error("One or more class groups are invalid for this school");
    }
    return oids;
  }
  if (mode === "students") {
    const n = await Student.countDocuments({
      _id: { $in: oids },
      schoolId,
      status: "active",
    });
    if (n !== oids.length) {
      throw new Error("One or more students are invalid or inactive");
    }
    return oids;
  }
  return [];
}
