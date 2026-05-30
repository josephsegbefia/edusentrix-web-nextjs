import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { ExamInvigilatorAssignment } from "@/models/ExamInvigilatorAssignment";
import { ExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { ExamVenue } from "@/models/ExamVenue";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { SchoolSettings } from "@/models/SchoolSettings";
import type {
  ExamSmartScheduleApplyResultDTO,
  ExamSmartScheduleProposalDTO,
} from "@/types/academics/exam-scheduling-engine";
import { resolveExamPolicyForSchool } from "@/lib/exams/exam-policy-service";
import {
  addMinutesToTime,
  computeSchedulerConfidenceScore,
  isWeekdayAllowed,
  rangesOverlap,
} from "@/lib/exams/exam-scheduler-validation";

const generateSmartScheduleBodySchema = z.object({
  dayStartTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).default("08:00"),
  dayEndTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).default("15:00"),
  slotGapMinutes: z.number().int().min(0).max(180).default(15),
  onlyUnscheduledEntries: z.boolean().default(true),
});

const smartScheduleDraftSchema = z.object({
  entryId: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number().int().min(15).max(720),
  venueId: z.string().nullable().optional(),
  suggestedInvigilatorTeacherId: z.string().nullable().optional(),
  subjectId: z.string().optional(),
  subjectName: z.string().nullable().optional(),
  classGroupIds: z.array(z.string()).optional(),
  classGroupNames: z.array(z.string()).optional(),
  venueName: z.string().nullable().optional(),
  suggestedInvigilatorName: z.string().nullable().optional(),
  explanation: z.string().optional(),
});

const smartScheduleUnscheduledSchema = z.object({
  entryId: z.string(),
  subjectId: z.string(),
  subjectName: z.string().nullable().optional(),
  classGroupIds: z.array(z.string()),
  classGroupNames: z.array(z.string()),
  reason: z.string(),
});

const applySmartScheduleBodySchema = z.object({
  proposal: z.object({
    examSessionId: z.string().optional(),
    generatedAt: z.string().optional(),
    confidenceScore: z.number().optional(),
    explanationSummary: z.string().optional(),
    warnings: z.array(z.string()).optional(),
    scheduledDrafts: z.array(smartScheduleDraftSchema).min(1),
    unscheduledItems: z.array(smartScheduleUnscheduledSchema).optional(),
    suggestedInvigilators: z
      .array(
        z.object({
          entryId: z.string(),
          teacherId: z.string(),
          teacherName: z.string().nullable().optional(),
          role: z.enum(["lead", "assistant", "standby", "relief"]),
          reason: z.string(),
        })
      )
      .optional(),
  }),
});

export type GenerateSmartScheduleBodyInput = z.infer<typeof generateSmartScheduleBodySchema>;
export type ApplySmartScheduleBodyInput = z.infer<typeof applySmartScheduleBodySchema>;

export class ExamSmartSchedulerServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamSmartSchedulerServiceError";
    this.status = status;
  }
}

export function parseGenerateSmartScheduleBody(body: unknown) {
  const parsed = generateSmartScheduleBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseApplySmartScheduleBody(body: unknown) {
  const parsed = applySmartScheduleBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

function eachDateInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= endDay.getTime()) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

type PlannedSlot = {
  entryId: string;
  classGroupIds: string[];
  dateKey: string;
  startTime: string;
  endTime: string;
  venueId: string | null;
  teacherId: string | null;
};

export async function generateSmartExamScheduleProposal(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  body: GenerateSmartScheduleBodyInput;
}): Promise<ExamSmartScheduleProposalDTO> {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamSmartSchedulerServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!session) {
    throw new ExamSmartSchedulerServiceError("Exam session not found.", 404);
  }

  if (["cancelled", "archived", "locked"].includes(session.status)) {
    throw new ExamSmartSchedulerServiceError(
      "Smart scheduling is not available for this session status.",
      409
    );
  }

  const policy = await resolveExamPolicyForSchool({
    schoolId: input.schoolId,
    policyId: session.policyId ?? null,
    actorId: session.createdBy,
  });

  const settings = await SchoolSettings.findOne({ schoolId: input.schoolId })
    .select("workingDays")
    .lean();
  const workingDays = settings?.workingDays?.length ? settings.workingDays : [1, 2, 3, 4, 5];

  const entryQuery: Record<string, unknown> = {
    schoolId: input.schoolId,
    examSessionId: session._id,
    status: { $nin: ["cancelled"] },
  };
  if (input.body.onlyUnscheduledEntries) {
    entryQuery.isUnscheduled = true;
  }

  const [entries, venues, teachers, existingAssignments] = await Promise.all([
    ExamTimetableEntry.find(entryQuery).lean(),
    ExamVenue.find({ schoolId: input.schoolId, isActive: true }).sort({ capacity: -1 }).lean(),
    Teacher.find({ schoolId: input.schoolId, status: "active" }).select("_id").lean(),
    TeacherAssignment.find({
      schoolId: input.schoolId,
      academicPeriodId: session.academicPeriodId,
      status: "active",
    })
      .select("teacherId subjectId classGroupId")
      .lean(),
  ]);

  if (!entries.length) {
    return {
      examSessionId: String(session._id),
      generatedAt: new Date().toISOString(),
      confidenceScore: 0,
      explanationSummary: "No draft exam papers were available to schedule.",
      warnings: ["Generate draft papers first or include already scheduled entries."],
      scheduledDrafts: [],
      unscheduledItems: [],
      suggestedInvigilators: [],
    };
  }

  const subjectIds = entries.map((entry) => entry.subjectId);
  const classGroupIds = entries.flatMap((entry) => entry.classGroupIds);
  const [subjects, classGroups] = await Promise.all([
    Subject.find({ _id: { $in: subjectIds }, schoolId: input.schoolId }).select("name").lean(),
    ClassGroup.find({ _id: { $in: classGroupIds }, schoolId: input.schoolId }).select("name").lean(),
  ]);

  const subjectMap = new Map(subjects.map((row) => [String(row._id), row.name]));
  const classGroupMap = new Map(classGroups.map((row) => [String(row._id), row.name]));

  const subjectTeacherMap = new Map<string, string>();
  for (const assignment of existingAssignments) {
    subjectTeacherMap.set(
      `${String(assignment.classGroupId)}|${String(assignment.subjectId)}`,
      String(assignment.teacherId)
    );
  }

  const scheduledEntries = await ExamTimetableEntry.find({
    schoolId: input.schoolId,
    examSessionId: session._id,
    isUnscheduled: false,
    status: { $nin: ["cancelled"] },
  })
    .select("classGroupIds date startTime endTime venueId")
    .lean();

  const planned: PlannedSlot[] = scheduledEntries.map((entry) => ({
    entryId: String(entry._id),
    classGroupIds: entry.classGroupIds.map(String),
    dateKey: entry.date.toISOString().slice(0, 10),
    startTime: entry.startTime,
    endTime: entry.endTime,
    venueId: entry.venueId ? String(entry.venueId) : null,
    teacherId: null,
  }));

  const classExamsPerDay = new Map<string, number>();
  const teacherInvigilationPerDay = new Map<string, number>();
  const warnings: string[] = [];
  const scheduledDrafts: ExamSmartScheduleProposalDTO["scheduledDrafts"] = [];
  const unscheduledItems: ExamSmartScheduleProposalDTO["unscheduledItems"] = [];
  const suggestedInvigilators: ExamSmartScheduleProposalDTO["suggestedInvigilators"] = [];

  const candidateDates = eachDateInRange(session.startDate, session.endDate).filter((date) =>
    isWeekdayAllowed(date, workingDays)
  );

  const sortedEntries = [...entries].sort((a, b) => {
    const subjectA = subjectMap.get(String(a.subjectId)) ?? "";
    const subjectB = subjectMap.get(String(b.subjectId)) ?? "";
    return subjectA.localeCompare(subjectB);
  });

  for (const entry of sortedEntries) {
    const entryClassGroupIds = entry.classGroupIds.map(String);
    const duration = entry.durationMinutes || 120;
    let placed = false;

    for (const date of candidateDates) {
      const dateKey = date.toISOString().slice(0, 10);
      let cursor = input.body.dayStartTime;

      while (cursor < input.body.dayEndTime) {
        const endTime = addMinutesToTime(cursor, duration);
        if (endTime > input.body.dayEndTime) break;

        const classDayKeys = entryClassGroupIds.map((classGroupId) => `${classGroupId}|${dateKey}`);
        const classCountExceeded = classDayKeys.some((key) => {
          const count = classExamsPerDay.get(key) ?? 0;
          return (
            policy.maxExamsPerClassPerDay !== null &&
            policy.maxExamsPerClassPerDay !== undefined &&
            count >= policy.maxExamsPerClassPerDay
          );
        });

        if (classCountExceeded) {
          cursor = addMinutesToTime(endTime, input.body.slotGapMinutes);
          continue;
        }

        const classOverlap = planned.some(
          (slot) =>
            slot.dateKey === dateKey &&
            slot.classGroupIds.some((classGroupId) => entryClassGroupIds.includes(classGroupId)) &&
            rangesOverlap(cursor, endTime, slot.startTime, slot.endTime)
        );
        if (classOverlap) {
          cursor = addMinutesToTime(endTime, input.body.slotGapMinutes);
          continue;
        }

        const venue =
          venues.find((row) => {
            const venueId = String(row._id);
            return !planned.some(
              (slot) =>
                slot.dateKey === dateKey &&
                slot.venueId === venueId &&
                rangesOverlap(cursor, endTime, slot.startTime, slot.endTime)
            );
          }) ?? null;

        if (policy.requireVenue && !venue) {
          cursor = addMinutesToTime(endTime, input.body.slotGapMinutes);
          continue;
        }

        const subjectTeacherIds = entryClassGroupIds
          .map((classGroupId) => subjectTeacherMap.get(`${classGroupId}|${String(entry.subjectId)}`))
          .filter(Boolean) as string[];

        const invigilator =
          teachers.find((teacher) => {
            const teacherId = String(teacher._id);
            if (subjectTeacherIds.includes(teacherId) && !policy.allowSubjectTeacherInvigilation) {
              return false;
            }
            const dayKey = `${teacherId}|${dateKey}`;
            const dayCount = teacherInvigilationPerDay.get(dayKey) ?? 0;
            if (
              policy.maxInvigilationSessionsPerTeacherPerDay !== null &&
              policy.maxInvigilationSessionsPerTeacherPerDay !== undefined &&
              dayCount >= policy.maxInvigilationSessionsPerTeacherPerDay
            ) {
              return false;
            }
            return !planned.some(
              (slot) =>
                slot.dateKey === dateKey &&
                slot.teacherId === teacherId &&
                rangesOverlap(cursor, endTime, slot.startTime, slot.endTime)
            );
          }) ?? null;

        planned.push({
          entryId: String(entry._id),
          classGroupIds: entryClassGroupIds,
          dateKey,
          startTime: cursor,
          endTime,
          venueId: venue ? String(venue._id) : null,
          teacherId: invigilator ? String(invigilator._id) : null,
        });

        for (const classGroupId of entryClassGroupIds) {
          const key = `${classGroupId}|${dateKey}`;
          classExamsPerDay.set(key, (classExamsPerDay.get(key) ?? 0) + 1);
        }
        if (invigilator) {
          const key = `${String(invigilator._id)}|${dateKey}`;
          teacherInvigilationPerDay.set(key, (teacherInvigilationPerDay.get(key) ?? 0) + 1);
        }

        scheduledDrafts.push({
          entryId: String(entry._id),
          subjectId: String(entry.subjectId),
          subjectName: subjectMap.get(String(entry.subjectId)) ?? null,
          classGroupIds: entryClassGroupIds,
          classGroupNames: entryClassGroupIds
            .map((id) => classGroupMap.get(id))
            .filter(Boolean) as string[],
          date: dateKey,
          startTime: cursor,
          endTime,
          durationMinutes: duration,
          venueId: venue ? String(venue._id) : null,
          venueName: venue?.name ?? null,
          suggestedInvigilatorTeacherId: invigilator ? String(invigilator._id) : null,
          suggestedInvigilatorName: invigilator ? "Teacher" : null,
          explanation: `Placed on ${dateKey} at ${cursor} with ${venue?.name ?? "no venue"}.${
            invigilator ? " Suggested invigilator assigned." : " No invigilator suggestion available."
          }`,
        });

        if (invigilator) {
          suggestedInvigilators.push({
            entryId: String(entry._id),
            teacherId: String(invigilator._id),
            teacherName: "Teacher",
            role: "lead",
            reason: "Lowest same-day invigilation load among available teachers.",
          });
        } else if (policy.requireInvigilator) {
          warnings.push(
            `No invigilator suggestion for ${subjectMap.get(String(entry.subjectId)) ?? "subject"} on ${dateKey}.`
          );
        }

        placed = true;
        break;
      }

      if (placed) break;
    }

    if (!placed) {
      unscheduledItems.push({
        entryId: String(entry._id),
        subjectId: String(entry.subjectId),
        subjectName: subjectMap.get(String(entry.subjectId)) ?? null,
        classGroupIds: entryClassGroupIds,
        classGroupNames: entryClassGroupIds
          .map((id) => classGroupMap.get(id))
          .filter(Boolean) as string[],
        reason: "No conflict-free slot found within the session range and policy limits.",
      });
    }
  }

  const confidenceScore = computeSchedulerConfidenceScore({
    scheduledCount: scheduledDrafts.length,
    totalCount: entries.length,
    warningCount: warnings.length + unscheduledItems.length,
  });

  return {
    examSessionId: String(session._id),
    generatedAt: new Date().toISOString(),
    confidenceScore,
    explanationSummary: `Scheduled ${scheduledDrafts.length} of ${entries.length} draft papers using policy-aware slot search.`,
    warnings,
    scheduledDrafts,
    unscheduledItems,
    suggestedInvigilators,
  };
}

export async function applySmartExamScheduleProposal(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  body: ApplySmartScheduleBodyInput;
}): Promise<ExamSmartScheduleApplyResultDTO> {
  let updatedEntryCount = 0;
  let invigilatorSuggestionsCount = 0;

  for (const draft of input.body.proposal.scheduledDrafts) {
    if (!mongoose.Types.ObjectId.isValid(draft.entryId)) continue;

    const entry = await ExamTimetableEntry.findOne({
      _id: draft.entryId,
      schoolId: input.schoolId,
      examSessionId: input.sessionId,
    });

    if (!entry) continue;

    entry.date = new Date(`${draft.date}T00:00:00.000Z`);
    entry.startTime = draft.startTime;
    entry.endTime = draft.endTime;
    entry.durationMinutes = draft.durationMinutes;
    entry.venueId = draft.venueId ? new Types.ObjectId(draft.venueId) : null;
    entry.isUnscheduled = false;
    if (entry.status === "published") entry.status = "ready";
    entry.updatedBy = input.actorId;
    await entry.save();
    updatedEntryCount += 1;

    if (
      draft.suggestedInvigilatorTeacherId &&
      mongoose.Types.ObjectId.isValid(draft.suggestedInvigilatorTeacherId)
    ) {
      const existing = await ExamInvigilatorAssignment.findOne({
        schoolId: input.schoolId,
        examTimetableEntryId: entry._id,
        teacherId: draft.suggestedInvigilatorTeacherId,
        status: { $in: ["assigned", "acknowledged"] },
      }).select("_id");

      if (!existing) {
        await ExamInvigilatorAssignment.create({
          schoolId: input.schoolId,
          examSessionId: entry.examSessionId,
          examTimetableEntryId: entry._id,
          teacherId: draft.suggestedInvigilatorTeacherId,
          role: "lead",
          status: "assigned",
          assignedBy: input.actorId,
          assignedAt: new Date(),
        });
        invigilatorSuggestionsCount += 1;
      }
    }
  }

  const source = input.body.proposal;
  const proposal: ExamSmartScheduleProposalDTO = {
    examSessionId: source.examSessionId ?? input.sessionId,
    generatedAt: source.generatedAt ?? new Date().toISOString(),
    confidenceScore:
      source.confidenceScore ??
      computeSchedulerConfidenceScore({
        scheduledCount: updatedEntryCount,
        totalCount: source.scheduledDrafts.length,
        warningCount: source.warnings?.length ?? 0,
      }),
    explanationSummary:
      updatedEntryCount > 0
        ? `Applied ${updatedEntryCount} scheduled slot(s) from the smart scheduler proposal.`
        : (source.explanationSummary ?? "No draft slots were applied."),
    warnings: source.warnings ?? [],
    scheduledDrafts: source.scheduledDrafts.map((draft) => ({
      entryId: draft.entryId,
      subjectId: draft.subjectId ?? "",
      subjectName: draft.subjectName ?? null,
      classGroupIds: draft.classGroupIds ?? [],
      classGroupNames: draft.classGroupNames ?? [],
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      durationMinutes: draft.durationMinutes,
      venueId: draft.venueId ?? null,
      venueName: draft.venueName ?? null,
      suggestedInvigilatorTeacherId: draft.suggestedInvigilatorTeacherId ?? null,
      suggestedInvigilatorName: draft.suggestedInvigilatorName ?? null,
      explanation: draft.explanation ?? "Applied from smart scheduler proposal.",
    })),
    unscheduledItems: source.unscheduledItems ?? [],
    suggestedInvigilators: source.suggestedInvigilators ?? [],
  };

  return {
    updatedEntryCount,
    invigilatorSuggestionsCount,
    proposal,
  };
}
