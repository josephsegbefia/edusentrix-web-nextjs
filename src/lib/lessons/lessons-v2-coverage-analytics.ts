import "server-only";

import mongoose, { type Types } from "mongoose";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonCoverageRecord } from "@/models/LessonCoverageRecord";
import { LessonWeekPlan } from "@/models/LessonWeekPlan";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { startOfUtcDay, endOfUtcDay } from "@/lib/lessons/admin-analytics.service";

export type V2CoverageAnalytics = {
  deliveriesCompletedInRange: number;
  coverageRecordsInRange: number;
  byClassGroup: Array<{
    classGroupId: string;
    label: string;
    completedDeliveries: number;
    schemeItemsCovered: number;
  }>;
  byWeek: Array<{
    weekPlanId: string;
    weekLabel: string;
    weekStartDate: string;
    completedDeliveries: number;
    schemeItemsCovered: number;
  }>;
};

async function classLabelMap(
  schoolId: Types.ObjectId,
  classGroupIds: Types.ObjectId[],
): Promise<Map<string, string>> {
  const groups = await ClassGroup.find({
    _id: { $in: classGroupIds },
    schoolId,
  })
    .select("name gradeId")
    .lean();
  const gradeIds = [
    ...new Set(groups.map((g) => g.gradeId).filter(Boolean) as Types.ObjectId[]),
  ];
  const grades =
    gradeIds.length > 0
      ? await Grade.find({ _id: { $in: gradeIds } })
          .select("name")
          .lean()
      : [];
  const gradeNames = new Map(grades.map((g) => [String(g._id), g.name]));
  const out = new Map<string, string>();
  for (const g of groups) {
    const gn = g.gradeId ? gradeNames.get(String(g.gradeId)) : undefined;
    out.set(String(g._id), gn ? `${gn} ${g.name}`.trim() : g.name);
  }
  return out;
}

export async function getV2CoverageAnalytics(input: {
  schoolId: Types.ObjectId;
  from: Date;
  to: Date;
  teacherId?: Types.ObjectId;
}): Promise<V2CoverageAnalytics> {
  const fromD = startOfUtcDay(input.from);
  const toD = endOfUtcDay(input.to);

  const deliveryMatch: Record<string, unknown> = {
    schoolId: input.schoolId,
    status: "completed",
    completedAt: { $gte: fromD, $lte: toD },
  };
  if (input.teacherId) {
    deliveryMatch.$or = [
      { ownerTeacherId: input.teacherId },
      { actualTeacherId: input.teacherId },
      { completedByTeacherId: input.teacherId },
    ];
  }

  const coverageMatch: Record<string, unknown> = {
    schoolId: input.schoolId,
    coveredAt: { $gte: fromD, $lte: toD },
  };
  if (input.teacherId) {
    coverageMatch.coveredByTeacherId = input.teacherId;
  }

  const [deliveriesCompletedInRange, coverageRecordsInRange, byClassAgg, byWeekDeliveryAgg, byWeekCoverageAgg] =
    await Promise.all([
      LessonDelivery.countDocuments(deliveryMatch),
      LessonCoverageRecord.countDocuments(coverageMatch),
      LessonDelivery.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: deliveryMatch },
        { $group: { _id: "$classGroupId", n: { $sum: 1 } } },
      ]),
      LessonDelivery.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: deliveryMatch },
        { $group: { _id: "$weekPlanId", n: { $sum: 1 } } },
      ]),
      LessonCoverageRecord.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: coverageMatch },
        { $group: { _id: "$weekPlanId", n: { $sum: 1 } } },
      ]),
    ]);

  const classIds = byClassAgg.map((r) => r._id);
  const classLabels = await classLabelMap(input.schoolId, classIds);

  const coverageByClass = await LessonCoverageRecord.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: coverageMatch },
    { $group: { _id: "$classGroupId", n: { $sum: 1 } } },
  ]);
  const coverageClassMap = new Map(coverageByClass.map((r) => [String(r._id), r.n]));

  const byClassGroup = byClassAgg
    .map((row) => ({
      classGroupId: String(row._id),
      label: classLabels.get(String(row._id)) || "Class",
      completedDeliveries: row.n,
      schemeItemsCovered: coverageClassMap.get(String(row._id)) ?? 0,
    }))
    .sort((a, b) => b.completedDeliveries - a.completedDeliveries);

  const weekIds = [
    ...new Set([
      ...byWeekDeliveryAgg.map((r) => String(r._id)),
      ...byWeekCoverageAgg.map((r) => String(r._id)),
    ]),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const weekPlans = weekIds.length
    ? await LessonWeekPlan.find({ _id: { $in: weekIds }, schoolId: input.schoolId })
        .select("weekLabel weekStartDate")
        .lean()
    : [];
  const weekMeta = new Map(
    weekPlans.map((w) => [
      String(w._id),
      {
        weekLabel: w.weekLabel,
        weekStartDate: w.weekStartDate ? new Date(w.weekStartDate).toISOString().slice(0, 10) : "",
      },
    ]),
  );

  const deliveryWeekMap = new Map(byWeekDeliveryAgg.map((r) => [String(r._id), r.n]));
  const coverageWeekMap = new Map(byWeekCoverageAgg.map((r) => [String(r._id), r.n]));

  const byWeek = weekIds
    .map((wid) => {
      const id = String(wid);
      const meta = weekMeta.get(id);
      return {
        weekPlanId: id,
        weekLabel: meta?.weekLabel || "Week",
        weekStartDate: meta?.weekStartDate || "",
        completedDeliveries: deliveryWeekMap.get(id) ?? 0,
        schemeItemsCovered: coverageWeekMap.get(id) ?? 0,
      };
    })
    .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));

  return {
    deliveriesCompletedInRange,
    coverageRecordsInRange,
    byClassGroup,
    byWeek,
  };
}
