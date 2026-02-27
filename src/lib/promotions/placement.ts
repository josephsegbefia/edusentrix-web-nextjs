// src/lib/promotions/placement.ts
// PROMO-BE-005: Placement selection per PROMOTION_SERVICE_SPEC §10.1
// Same-section promotion: JHS 1 A → JHS 2 A, Primary 2 B → Primary 3 B
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Student } from "@/models/Student";
import type { Types } from "mongoose";

export type PlacementResult = {
  targetGradeId: Types.ObjectId;
  targetClassGroupId: Types.ObjectId;
  conflict?: string;
};

/**
 * Select target class for promotion. Prefers same section (e.g. 1A → 2A, 2B → 3B).
 * Falls back to least-loaded class if same section not found or at capacity.
 */
export async function selectClassForPromotion(
  fromGradeId: Types.ObjectId,
  fromClassGroupId: Types.ObjectId,
  schoolId: Types.ObjectId
): Promise<{ targetGradeId: Types.ObjectId; targetClassGroupId: Types.ObjectId; conflict?: string } | null> {
  const nextGradeId = await findNextGrade(fromGradeId, schoolId);
  if (!nextGradeId) return null;

  const fromClass = await ClassGroup.findOne({
    _id: fromClassGroupId,
    schoolId,
  })
    .select("name")
    .lean();

  const preferredSectionName = fromClass?.name?.trim();
  if (preferredSectionName) {
    const sameSectionClass = await ClassGroup.findOne({
      schoolId,
      gradeId: nextGradeId,
      name: { $regex: new RegExp(`^${escapeRegex(preferredSectionName)}$`, "i") },
      isActive: true,
    })
      .select("_id name capacity")
      .lean();

    if (sameSectionClass) {
      const count = await Student.countDocuments({
        schoolId,
        classGroupId: sameSectionClass._id,
        status: "active",
      });
      const capacity = sameSectionClass.capacity ?? Infinity;
      if (count < capacity) {
        return {
          targetGradeId: nextGradeId,
          targetClassGroupId: sameSectionClass._id as Types.ObjectId,
        };
      }
      return {
        targetGradeId: nextGradeId,
        targetClassGroupId: sameSectionClass._id as Types.ObjectId,
        conflict: "NO_CAPACITY_TARGET_GRADE",
      };
    }
  }

  const fallback = await selectLeastLoadedClass(nextGradeId, schoolId);
  if (!fallback) return null;
  return {
    targetGradeId: nextGradeId,
    targetClassGroupId: fallback.classGroupId,
    conflict: fallback.conflict,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find the next grade by order (same school).
 */
export async function findNextGrade(
  fromGradeId: Types.ObjectId,
  schoolId: Types.ObjectId
): Promise<Types.ObjectId | null> {
  const fromGrade = await Grade.findOne({
    _id: fromGradeId,
    schoolId,
  })
    .select("order")
    .lean();

  if (!fromGrade) return null;

  const nextOrder = (fromGrade.order ?? 0) + 1;
  const nextGrade = await Grade.findOne({
    schoolId,
    isActive: true,
    order: nextOrder,
  })
    .select("_id")
    .lean();

  return nextGrade?._id ?? null;
}

/**
 * Select least-loaded active class in target grade.
 * Tie breaker: lower count -> higher remaining capacity -> name asc -> createdAt asc.
 */
export async function selectLeastLoadedClass(
  targetGradeId: Types.ObjectId,
  schoolId: Types.ObjectId
): Promise<{ classGroupId: Types.ObjectId; conflict?: string } | null> {
  const classes = await ClassGroup.find({
    schoolId,
    gradeId: targetGradeId,
    isActive: true,
  })
    .select("_id name capacity createdAt")
    .lean();

  if (classes.length === 0) {
    return null;
  }

  const studentCounts = await Student.aggregate([
    {
      $match: {
        schoolId,
        classGroupId: { $in: classes.map((c) => c._id) },
        status: "active",
      },
    },
    { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
  ]);

  const countMap = new Map(
    studentCounts.map((s: { _id: Types.ObjectId; count: number }) => [String(s._id), s.count])
  );

  const withMeta = classes.map((c: Record<string, unknown>) => {
    const count = countMap.get(String(c._id)) ?? 0;
    const capacity = (c.capacity as number) ?? Infinity;
    const remaining = Math.max(0, capacity - count);
    return {
      _id: c._id,
      name: c.name,
      count,
      capacity,
      remaining,
      createdAt: c.createdAt,
    };
  });

  const sorted = withMeta.sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count;
    if (a.remaining !== b.remaining) return b.remaining - a.remaining;
    return String(a.name).localeCompare(String(b.name));
  });

  const best = sorted[0];
  if (!best) return null;

  const capacity = best.capacity === Infinity ? null : best.capacity;
  if (capacity != null && best.count >= capacity) {
    return { classGroupId: best._id as Types.ObjectId, conflict: "NO_CAPACITY_TARGET_GRADE" };
  }

  return { classGroupId: best._id as Types.ObjectId };
}
