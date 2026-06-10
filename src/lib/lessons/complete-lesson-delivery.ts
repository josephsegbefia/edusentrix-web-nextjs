import "server-only";

import mongoose from "mongoose";
import { LessonCoverageRecord } from "@/models/LessonCoverageRecord";
import type { ILessonDelivery } from "@/models/LessonDelivery";
import type { ILessonSession } from "@/models/LessonSession";

export async function writeCoverageForCompletedDelivery(input: {
  session: ILessonSession;
  delivery: ILessonDelivery;
  teacherId: mongoose.Types.ObjectId;
}): Promise<number> {
  const schemeIds = input.session.noteSectionAllocation?.schemeItemIds ?? [];
  if (schemeIds.length === 0) return 0;

  const now = new Date();
  let written = 0;

  for (const schemeItemId of schemeIds) {
    try {
      await LessonCoverageRecord.findOneAndUpdate(
        {
          schoolId: input.session.schoolId,
          classGroupId: input.delivery.classGroupId,
          schemeItemId,
          weekPlanId: input.session.weekPlanId,
        },
        {
          $setOnInsert: {
            schoolId: input.session.schoolId,
            classGroupId: input.delivery.classGroupId,
            subjectOfferingId: input.session.subjectOfferingId,
            weekPlanId: input.session.weekPlanId,
            lessonNoteId: input.session.lessonNoteId,
            sessionId: input.session._id,
            deliveryId: input.delivery._id,
            schemeItemId,
            coveredAt: now,
            coveredByTeacherId: input.teacherId,
          },
        },
        { upsert: true },
      );
      written += 1;
    } catch {
      // duplicate key — already covered for this class/week/scheme item
    }
  }

  return written;
}
