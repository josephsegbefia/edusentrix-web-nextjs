import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE } from "@/constants/academics/exam-scheduling-engine";
import { AssessmentItem, type IAssessmentItem } from "@/models/AssessmentItem";
import { ClassGroup } from "@/models/ClassGroup";
import { ExamSession, type IExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry, type IExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { recordAssessmentMarksAudit } from "@/lib/academics/assessment-engine/assessment-marks-audit";
import { resolveContributionFlags } from "@/lib/academics/assessment-engine/assessment-item-service";
import { resolveTeacherMarksScope } from "@/lib/academics/assessment-engine/assessment-marks-context";
import {
  serializeAssessmentItem,
  type TeacherGradebookAccessContext,
} from "@/lib/academics/assessment-engine/teacher-gradebook-service";
import {
  recordExamAssessmentLinkCreated,
  recordExamAssessmentLinked,
  recordExamAssessmentUnlinked,
} from "@/lib/exams/exam-assessment-audit";
import {
  buildExamAssessmentLinkStatus,
  entryRequiresAssessmentLink,
  listMissingAssessmentLinkEntries,
  resolvePrimaryAssessmentItemId,
  validateAssessmentItemForExamEntryLink,
  type ExamAssessmentLinkEntryInput,
  type ExamAssessmentLinkItemInput,
} from "@/lib/exams/exam-assessment-link-validation";
import {
  serializeExamTimetableEntry,
} from "@/lib/exams/exam-timetable-entry-service";
import type {
  AssessmentItemDTO,
} from "@/types/academics/assessment-engine";
import type {
  ExamAssessmentLinkStatusDTO,
  ExamEntryMissingAssessmentLinkDTO,
  ExamLinkableAssessmentItemDTO,
  ExamSessionStatus,
  ExamTimetableEntryDTO,
} from "@/types/academics/exam-scheduling-engine";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

const createLinkedAssessmentItemsBodySchema = z
  .object({
    classGroupIds: z.array(objectIdSchema).min(1).optional(),
    maxScore: z.number().min(1).max(1000).optional(),
    componentKey: z.string().trim().max(80).nullable().optional(),
    title: z.string().trim().min(1).max(300).optional(),
  })
  .optional();

const linkExistingAssessmentItemBodySchema = z.object({
  assessmentItemId: objectIdSchema,
  classGroupId: objectIdSchema,
});

const unlinkAssessmentLinkBodySchema = z
  .object({
    classGroupId: objectIdSchema.optional(),
  })
  .optional();

export type CreateLinkedAssessmentItemsBodyInput = z.infer<
  typeof createLinkedAssessmentItemsBodySchema
>;
export type LinkExistingAssessmentItemBodyInput = z.infer<
  typeof linkExistingAssessmentItemBodySchema
>;
export type UnlinkAssessmentLinkBodyInput = z.infer<typeof unlinkAssessmentLinkBodySchema>;

export class ExamAssessmentLinkServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamAssessmentLinkServiceError";
    this.status = status;
  }
}

const MUTABLE_SESSION_STATUSES: ExamSessionStatus[] = [
  "draft",
  "scheduled",
  "conflict_review",
];

const MUTABLE_ENTRY_STATUSES = new Set(["draft", "ready"]);

function toObjectId(value: string | Types.ObjectId) {
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}

export function toEntryInput(entry: IExamTimetableEntry): ExamAssessmentLinkEntryInput {
  return {
    id: String(entry._id),
    title: entry.title ?? null,
    subjectId: String(entry.subjectId),
    academicPeriodId: String(entry.academicPeriodId),
    classGroupIds: entry.classGroupIds.map(String),
    contributesToReport: entry.contributesToReport,
    assessmentComponentKey: entry.assessmentComponentKey ?? null,
    maxScore: entry.maxScore ?? null,
    assessmentItemId: entry.assessmentItemId ? String(entry.assessmentItemId) : null,
  };
}

function toItemInput(item: Pick<
  IAssessmentItem,
  | "_id"
  | "schoolId"
  | "academicPeriodId"
  | "subjectId"
  | "classGroupId"
  | "contributesToReport"
  | "componentKey"
  | "maxScore"
  | "sourceRefType"
  | "sourceRefId"
  | "status"
>): ExamAssessmentLinkItemInput {
  return {
    id: String(item._id),
    schoolId: String(item.schoolId),
    academicPeriodId: String(item.academicPeriodId),
    subjectId: String(item.subjectId),
    classGroupId: String(item.classGroupId),
    contributesToReport: item.contributesToReport,
    componentKey: item.componentKey ?? null,
    maxScore: item.maxScore,
    sourceRefType: item.sourceRefType ?? null,
    sourceRefId: item.sourceRefId ? String(item.sourceRefId) : null,
    status: item.status,
  };
}

export function parseCreateLinkedAssessmentItemsBody(body: unknown) {
  const parsed = createLinkedAssessmentItemsBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data ?? {} };
}

export function parseLinkExistingAssessmentItemBody(body: unknown) {
  const parsed = linkExistingAssessmentItemBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseUnlinkAssessmentLinkBody(body: unknown) {
  const parsed = unlinkAssessmentLinkBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data ?? {} };
}

async function loadMutableExamSession(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
}): Promise<IExamSession> {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamAssessmentLinkServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!session) {
    throw new ExamAssessmentLinkServiceError("Exam session not found.", 404);
  }

  if (!MUTABLE_SESSION_STATUSES.includes(session.status)) {
    throw new ExamAssessmentLinkServiceError(
      "Assessment links cannot be changed while the exam session is published or locked.",
      409
    );
  }

  return session;
}

async function loadMutableExamEntry(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  entryId: string;
}): Promise<{ session: IExamSession; entry: IExamTimetableEntry }> {
  const session = await loadMutableExamSession(input);

  if (!mongoose.Types.ObjectId.isValid(input.entryId)) {
    throw new ExamAssessmentLinkServiceError("Invalid exam timetable entry id.", 400);
  }

  const entry = await ExamTimetableEntry.findOne({
    _id: input.entryId,
    schoolId: input.schoolId,
    examSessionId: session._id,
  });

  if (!entry) {
    throw new ExamAssessmentLinkServiceError("Exam timetable entry not found.", 404);
  }

  if (!MUTABLE_ENTRY_STATUSES.has(entry.status)) {
    throw new ExamAssessmentLinkServiceError(
      "Assessment links cannot be changed on published or completed exam entries.",
      409
    );
  }

  return { session, entry };
}

async function loadLinkedItemsForEntry(input: {
  schoolId: Types.ObjectId;
  entryId: Types.ObjectId;
}): Promise<IAssessmentItem[]> {
  return AssessmentItem.find({
    schoolId: input.schoolId,
    sourceRefType: EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE,
    sourceRefId: input.entryId,
  }).lean();
}

async function resolveSubjectTeacherId(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
}) {
  const assignment = await TeacherAssignment.findOne({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    subjectId: input.subjectId,
    academicPeriodId: input.academicPeriodId,
    status: "active",
  })
    .select("teacherId")
    .lean();

  return assignment?.teacherId ?? null;
}

async function resolveAssessmentScopeForClassGroup(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  sessionAssessmentPlanId?: Types.ObjectId | null;
}) {
  const adminContext: TeacherGradebookAccessContext = {
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    isAdmin: true,
  };

  const scopeResult = await resolveTeacherMarksScope(adminContext, {
    classGroupId: String(input.classGroupId),
    subjectId: String(input.subjectId),
    academicPeriodId: String(input.academicPeriodId),
  });

  if (!scopeResult.ok) {
    throw new ExamAssessmentLinkServiceError(scopeResult.error, scopeResult.status);
  }

  if (
    input.sessionAssessmentPlanId &&
    String(scopeResult.scope.assessmentPlan._id) !== String(input.sessionAssessmentPlanId)
  ) {
    throw new ExamAssessmentLinkServiceError(
      "The active assessment plan for this class does not match the exam session assessment plan.",
      400
    );
  }

  return scopeResult.scope;
}

async function buildDefaultAssessmentTitle(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId: Types.ObjectId;
  sessionName: string;
  entryTitle?: string | null;
}) {
  const [classGroup, subject] = await Promise.all([
    ClassGroup.findOne({ _id: input.classGroupId, schoolId: input.schoolId })
      .select("name gradeId")
      .lean(),
    Subject.findOne({ _id: input.subjectId, schoolId: input.schoolId }).select("name").lean(),
  ]);

  const grade = classGroup?.gradeId
    ? await Grade.findById(classGroup.gradeId).select("name").lean()
    : null;
  const gradeName = grade?.name ?? "";
  const className = classGroup?.name ?? "Class";
  const subjectName = subject?.name ?? "Subject";

  if (input.entryTitle?.trim()) {
    return input.entryTitle.trim();
  }

  return [gradeName || className, subjectName, input.sessionName].filter(Boolean).join(" ");
}

async function syncEntryAssessmentItemId(input: {
  entry: IExamTimetableEntry;
  linkedItems: IAssessmentItem[];
  actorId: Types.ObjectId;
}) {
  const entryInput = toEntryInput(input.entry);
  const linkedItemInputs = input.linkedItems.map((item) => toItemInput(item));
  const nextAssessmentItemId = resolvePrimaryAssessmentItemId(entryInput, linkedItemInputs);

  if (
    String(input.entry.assessmentItemId ?? "") === String(nextAssessmentItemId ?? "")
  ) {
    return input.entry;
  }

  input.entry.assessmentItemId = nextAssessmentItemId
    ? toObjectId(nextAssessmentItemId)
    : null;
  input.entry.updatedBy = input.actorId;
  await input.entry.save();

  return input.entry;
}

export async function getExamEntryAssessmentLinkStatus(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  entryId: string;
}): Promise<ExamAssessmentLinkStatusDTO> {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId) || !mongoose.Types.ObjectId.isValid(input.entryId)) {
    throw new ExamAssessmentLinkServiceError("Invalid id.", 400);
  }

  const entry = await ExamTimetableEntry.findOne({
    _id: input.entryId,
    schoolId: input.schoolId,
    examSessionId: input.sessionId,
  }).lean();

  if (!entry) {
    throw new ExamAssessmentLinkServiceError("Exam timetable entry not found.", 404);
  }

  const linkedItems = await loadLinkedItemsForEntry({
    schoolId: input.schoolId,
    entryId: entry._id as Types.ObjectId,
  });

  const classGroups = await ClassGroup.find({
    _id: { $in: entry.classGroupIds },
    schoolId: input.schoolId,
  })
    .select("_id name")
    .lean();

  const classGroupNames = Object.fromEntries(
    classGroups.map((group) => [String(group._id), group.name ?? null])
  );

  return buildExamAssessmentLinkStatus({
    entry: toEntryInput(entry as IExamTimetableEntry),
    linkedItems: linkedItems.map((item) => toItemInput(item)),
    classGroupNames,
    schoolId: String(input.schoolId),
  });
}

export async function listExamSessionMissingAssessmentLinks(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
}): Promise<ExamEntryMissingAssessmentLinkDTO[]> {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamAssessmentLinkServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  }).lean();

  if (!session) {
    throw new ExamAssessmentLinkServiceError("Exam session not found.", 404);
  }

  const entries = await ExamTimetableEntry.find({
    schoolId: input.schoolId,
    examSessionId: session._id,
    status: { $nin: ["cancelled"] },
  }).lean();

  const entryIds = entries.map((entry) => entry._id as Types.ObjectId);
  const linkedItems = entryIds.length
    ? await AssessmentItem.find({
        schoolId: input.schoolId,
        sourceRefType: EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE,
        sourceRefId: { $in: entryIds },
      }).lean()
    : [];

  const linkedItemsByEntryId: Record<string, ExamAssessmentLinkItemInput[]> = {};
  for (const item of linkedItems) {
    const entryId = String(item.sourceRefId);
    linkedItemsByEntryId[entryId] ??= [];
    linkedItemsByEntryId[entryId].push(toItemInput(item));
  }

  return listMissingAssessmentLinkEntries({
    entries: entries.map((entry) => toEntryInput(entry as IExamTimetableEntry)),
    linkedItemsByEntryId,
  });
}

export async function createLinkedAssessmentItemsForExamEntry(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  entryId: string;
  body?: CreateLinkedAssessmentItemsBodyInput;
}): Promise<{
  status: ExamAssessmentLinkStatusDTO;
  createdItems: AssessmentItemDTO[];
  entry: ExamTimetableEntryDTO;
}> {
  const { session, entry } = await loadMutableExamEntry(input);

  if (!entryRequiresAssessmentLink(entry)) {
    throw new ExamAssessmentLinkServiceError(
      "This exam entry does not require an assessment link.",
      400
    );
  }

  const targetClassGroupIds = (input.body?.classGroupIds?.length
    ? input.body.classGroupIds
    : entry.classGroupIds.map(String)
  ).map((id) => toObjectId(id));

  for (const classGroupId of targetClassGroupIds) {
    if (!entry.classGroupIds.some((id) => String(id) === String(classGroupId))) {
      throw new ExamAssessmentLinkServiceError(
        "One or more class groups are not part of this exam entry.",
        400
      );
    }
  }

  const componentKey =
    input.body?.componentKey !== undefined
      ? input.body.componentKey
      : entry.assessmentComponentKey ?? "exam";
  const maxScore = input.body?.maxScore ?? entry.maxScore ?? 100;
  const createdItems: AssessmentItemDTO[] = [];

  for (const classGroupId of targetClassGroupIds) {
    const existing = await AssessmentItem.findOne({
      schoolId: input.schoolId,
      sourceRefType: EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE,
      sourceRefId: entry._id,
      classGroupId,
    }).lean();

    if (existing) {
      continue;
    }

    const teacherId = await resolveSubjectTeacherId({
      schoolId: input.schoolId,
      classGroupId,
      subjectId: entry.subjectId as Types.ObjectId,
      academicPeriodId: entry.academicPeriodId as Types.ObjectId,
    });

    if (!teacherId) {
      throw new ExamAssessmentLinkServiceError(
        "No active subject teacher assignment was found for one of the selected class groups.",
        400
      );
    }

    const scope = await resolveAssessmentScopeForClassGroup({
      schoolId: input.schoolId,
      teacherId,
      classGroupId,
      subjectId: entry.subjectId as Types.ObjectId,
      academicPeriodId: entry.academicPeriodId as Types.ObjectId,
      sessionAssessmentPlanId: session.assessmentPlanId ?? null,
    });

    const title =
      input.body?.title ??
      (await buildDefaultAssessmentTitle({
        schoolId: input.schoolId,
        classGroupId,
        subjectId: entry.subjectId as Types.ObjectId,
        sessionName: session.name,
        entryTitle: entry.title,
      }));

    const contribution = resolveContributionFlags({
      componentKey,
      assessmentType: "exam",
      title,
      requestedContributesToReport: true,
      assessmentPlan: scope.assessmentPlan,
      gradingPolicy: scope.gradingPolicy,
    });

    if (!contribution.ok) {
      throw new ExamAssessmentLinkServiceError(contribution.error, 400);
    }

    const created = await AssessmentItem.create({
      schoolId: input.schoolId,
      academicPeriodId: entry.academicPeriodId,
      assessmentPlanId: toObjectId(scope.assessmentPlan._id),
      classGroupId,
      gradeId: scope.gradeId,
      subjectId: entry.subjectId,
      teacherId,
      title,
      description: entry.instructionsForStudents ?? null,
      assessmentType: "exam",
      sourceType: "exam",
      sourceRefType: EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE,
      sourceRefId: entry._id,
      maxScore,
      dateAssigned: entry.date,
      dateDue: entry.date,
      assessedAt: null,
      componentKey,
      contributesToReport: contribution.contributesToReport,
      contributionLockedByRule: contribution.contributionLockedByRule,
      missingPolicy: "exclude_from_average",
      visibility: "teacher_only",
      status: "open",
      createdBy: input.actorId,
      updatedBy: input.actorId,
    });

    await recordAssessmentMarksAudit({
      schoolId: input.schoolId,
      actorUserId: input.actorId,
      teacherId,
      action: "assessment_item.created",
      entityType: "assessment_item",
      entityId: created._id as Types.ObjectId,
      classGroupId,
      subjectId: entry.subjectId as Types.ObjectId,
      academicPeriodId: entry.academicPeriodId as Types.ObjectId,
      assessmentPlanId: toObjectId(scope.assessmentPlan._id),
      metadata: {
        source: "exam_timetable_entry",
        examSessionId: String(session._id),
        examTimetableEntryId: String(entry._id),
        contributesToReport: contribution.contributesToReport,
      },
    });

    await recordExamAssessmentLinkCreated({
      schoolId: input.schoolId,
      actorId: input.actorId,
      examSessionId: session._id as Types.ObjectId,
      examTimetableEntryId: entry._id as Types.ObjectId,
      assessmentItemId: created._id as Types.ObjectId,
      classGroupId,
    });

    createdItems.push(serializeAssessmentItem(created.toObject()));
  }

  const linkedItems = await loadLinkedItemsForEntry({
    schoolId: input.schoolId,
    entryId: entry._id as Types.ObjectId,
  });

  const syncedEntry = await syncEntryAssessmentItemId({
    entry,
    linkedItems,
    actorId: input.actorId,
  });

  const status = buildExamAssessmentLinkStatus({
    entry: toEntryInput(syncedEntry),
    linkedItems: linkedItems.map((item) => toItemInput(item)),
    schoolId: String(input.schoolId),
  });

  return {
    status,
    createdItems,
    entry: serializeExamTimetableEntry(syncedEntry),
  };
}

export async function linkExistingAssessmentItemToExamEntry(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  entryId: string;
  body: LinkExistingAssessmentItemBodyInput;
}): Promise<{
  status: ExamAssessmentLinkStatusDTO;
  assessmentItem: AssessmentItemDTO;
  entry: ExamTimetableEntryDTO;
}> {
  const { session, entry } = await loadMutableExamEntry(input);

  if (!entryRequiresAssessmentLink(entry)) {
    throw new ExamAssessmentLinkServiceError(
      "This exam entry does not require an assessment link.",
      400
    );
  }

  const classGroupId = toObjectId(input.body.classGroupId);
  if (!entry.classGroupIds.some((id) => String(id) === String(classGroupId))) {
    throw new ExamAssessmentLinkServiceError(
      "Class group is not part of this exam entry.",
      400
    );
  }

  const item = await AssessmentItem.findOne({
    _id: input.body.assessmentItemId,
    schoolId: input.schoolId,
  }).lean();

  if (!item) {
    throw new ExamAssessmentLinkServiceError("Assessment item not found.", 404);
  }

  const validation = validateAssessmentItemForExamEntryLink({
    entry: toEntryInput(entry),
    item: toItemInput(item),
    classGroupId: input.body.classGroupId,
    schoolId: String(input.schoolId),
  });

  if (!validation.ok) {
    throw new ExamAssessmentLinkServiceError(validation.errors[0], 400);
  }

  const updated = await AssessmentItem.findOneAndUpdate(
    { _id: item._id, schoolId: input.schoolId },
    {
      $set: {
        sourceType: "exam",
        sourceRefType: EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE,
        sourceRefId: entry._id,
        updatedBy: input.actorId,
      },
    },
    { new: true }
  ).lean();

  if (!updated) {
    throw new ExamAssessmentLinkServiceError("Assessment item not found.", 404);
  }

  await recordExamAssessmentLinked({
    schoolId: input.schoolId,
    actorId: input.actorId,
    examSessionId: session._id as Types.ObjectId,
    examTimetableEntryId: entry._id as Types.ObjectId,
    assessmentItemId: updated._id as Types.ObjectId,
    classGroupId,
  });

  const linkedItems = await loadLinkedItemsForEntry({
    schoolId: input.schoolId,
    entryId: entry._id as Types.ObjectId,
  });

  const syncedEntry = await syncEntryAssessmentItemId({
    entry,
    linkedItems,
    actorId: input.actorId,
  });

  const status = buildExamAssessmentLinkStatus({
    entry: toEntryInput(syncedEntry),
    linkedItems: linkedItems.map((row) => toItemInput(row)),
    schoolId: String(input.schoolId),
  });

  return {
    status,
    assessmentItem: serializeAssessmentItem(updated),
    entry: serializeExamTimetableEntry(syncedEntry),
  };
}

export async function unlinkAssessmentItemFromExamEntry(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  entryId: string;
  body?: UnlinkAssessmentLinkBodyInput;
}): Promise<{
  status: ExamAssessmentLinkStatusDTO;
  entry: ExamTimetableEntryDTO;
}> {
  const { session, entry } = await loadMutableExamEntry(input);

  const classGroupFilter = input.body?.classGroupId
    ? [toObjectId(input.body.classGroupId)]
    : entry.classGroupIds;

  for (const classGroupId of classGroupFilter) {
    if (!entry.classGroupIds.some((id) => String(id) === String(classGroupId))) {
      throw new ExamAssessmentLinkServiceError(
        "Class group is not part of this exam entry.",
        400
      );
    }
  }

  const linkedItems = await AssessmentItem.find({
    schoolId: input.schoolId,
    sourceRefType: EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE,
    sourceRefId: entry._id,
    classGroupId: { $in: classGroupFilter },
  }).lean();

  for (const item of linkedItems) {
    await AssessmentItem.updateOne(
      { _id: item._id, schoolId: input.schoolId },
      {
        $set: {
          sourceRefType: null,
          sourceRefId: null,
          updatedBy: input.actorId,
        },
      }
    );

    await recordExamAssessmentUnlinked({
      schoolId: input.schoolId,
      actorId: input.actorId,
      examSessionId: session._id as Types.ObjectId,
      examTimetableEntryId: entry._id as Types.ObjectId,
      assessmentItemId: item._id as Types.ObjectId,
      classGroupId: item.classGroupId as Types.ObjectId,
    });
  }

  const remainingLinkedItems = await loadLinkedItemsForEntry({
    schoolId: input.schoolId,
    entryId: entry._id as Types.ObjectId,
  });

  const syncedEntry = await syncEntryAssessmentItemId({
    entry,
    linkedItems: remainingLinkedItems,
    actorId: input.actorId,
  });

  const status = buildExamAssessmentLinkStatus({
    entry: toEntryInput(syncedEntry),
    linkedItems: remainingLinkedItems.map((row) => toItemInput(row)),
    schoolId: String(input.schoolId),
  });

  return {
    status,
    entry: serializeExamTimetableEntry(syncedEntry),
  };
}

export async function validateExamEntryAssessmentLink(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  entryId: string;
}): Promise<ExamAssessmentLinkStatusDTO> {
  return getExamEntryAssessmentLinkStatus(input);
}

export async function listLinkableAssessmentItemsForExamEntry(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  entryId: string;
  classGroupId: string;
}): Promise<ExamLinkableAssessmentItemDTO[]> {
  if (
    !mongoose.Types.ObjectId.isValid(input.sessionId) ||
    !mongoose.Types.ObjectId.isValid(input.entryId) ||
    !mongoose.Types.ObjectId.isValid(input.classGroupId)
  ) {
    throw new ExamAssessmentLinkServiceError("Invalid id.", 400);
  }

  const entry = await ExamTimetableEntry.findOne({
    _id: input.entryId,
    schoolId: input.schoolId,
    examSessionId: input.sessionId,
  }).lean();

  if (!entry) {
    throw new ExamAssessmentLinkServiceError("Exam timetable entry not found.", 404);
  }

  const classGroupId = input.classGroupId;
  if (!entry.classGroupIds.some((id) => String(id) === classGroupId)) {
    throw new ExamAssessmentLinkServiceError(
      "Class group is not part of this exam entry.",
      400
    );
  }

  const entryInput = toEntryInput(entry as IExamTimetableEntry);
  const items = await AssessmentItem.find({
    schoolId: input.schoolId,
    academicPeriodId: entry.academicPeriodId,
    subjectId: entry.subjectId,
    classGroupId,
    status: { $nin: ["locked", "archived"] },
  })
    .select("_id title assessmentType maxScore componentKey contributesToReport status sourceRefType sourceRefId subjectId academicPeriodId classGroupId")
    .sort({ title: 1 })
    .limit(100)
    .lean();

  return items.map((item) => {
    const itemInput = toItemInput(item as IAssessmentItem);
    const isLinkedToEntry =
      item.sourceRefType === EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE &&
      String(item.sourceRefId) === String(entry._id);
    const validation = validateAssessmentItemForExamEntryLink({
      entry: entryInput,
      item: itemInput,
      classGroupId,
      schoolId: String(input.schoolId),
    });

    return {
      id: String(item._id),
      title: item.title,
      assessmentType: String(item.assessmentType),
      maxScore: item.maxScore,
      componentKey: item.componentKey ?? null,
      contributesToReport: item.contributesToReport,
      status: item.status,
      isLinkedToEntry,
      isEligible: validation.ok || isLinkedToEntry,
      ineligibilityReason: validation.ok ? null : validation.errors[0] ?? null,
    };
  });
}
