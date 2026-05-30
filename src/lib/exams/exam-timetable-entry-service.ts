import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { EXAM_TIME_PATTERN } from "@/constants/academics/exam-scheduling-engine";
import { ClassGroup } from "@/models/ClassGroup";
import { ExamSession, type IExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry, type IExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { ExamVenue } from "@/models/ExamVenue";
import { Subject } from "@/models/Subject";
import { SubjectOffering } from "@/models/SubjectOffering";
import { parseTimeToMinutes } from "@/lib/timetable/validate";
import type {
  ExamSessionStatus,
  ExamTimetableEntryDTO,
  ExamTimetableEntryStatus,
} from "@/types/academics/exam-scheduling-engine";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

const objectIdListSchema = z
  .array(objectIdSchema)
  .min(1, "At least one class group is required.");

const dateInputSchema = z.union([
  z.string().datetime(),
  z.string().date(),
  z.coerce.date(),
]);

const timeSchema = z.string().trim().regex(EXAM_TIME_PATTERN, "Time must be HH:mm.");

const examTimetableEntryBodySchema = z.object({
  title: z.string().trim().max(300).nullable().optional(),
  subjectId: objectIdSchema,
  gradeId: objectIdSchema.nullable().optional(),
  classGroupIds: objectIdListSchema,
  date: dateInputSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  venueId: objectIdSchema.nullable().optional(),
  roomLabel: z.string().trim().max(200).nullable().optional(),
  capacityRequired: z.number().int().min(1).nullable().optional(),
  contributesToReport: z.boolean().optional(),
  assessmentComponentKey: z.string().trim().max(80).nullable().optional(),
  maxScore: z.number().min(1).max(1000).nullable().optional(),
  instructionsForInvigilators: z.string().trim().max(5000).nullable().optional(),
  instructionsForStudents: z.string().trim().max(5000).nullable().optional(),
  materialsAllowed: z.array(z.string().trim().max(120)).optional(),
  specialNotes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["draft", "ready"]).optional(),
});

const updateExamTimetableEntryBodySchema = examTimetableEntryBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

const bulkCreateExamTimetableEntriesBodySchema = z.object({
  entries: z.array(examTimetableEntryBodySchema).min(1).max(200),
});

const generateDraftExamTimetableEntriesBodySchema = z.object({
  classGroupIds: z.array(objectIdSchema).min(1, "Select at least one class group."),
  subjectIds: z.array(objectIdSchema).default([]),
  defaultDurationMinutes: z.number().int().min(15).max(720).default(120),
  defaultMaxScore: z.number().min(1).max(1000).nullable().optional(),
  assessmentComponentKey: z.string().trim().max(80).nullable().optional(),
  contributesToReport: z.boolean().optional(),
});

export type CreateExamTimetableEntryBodyInput = z.infer<typeof examTimetableEntryBodySchema>;
export type UpdateExamTimetableEntryBodyInput = z.infer<
  typeof updateExamTimetableEntryBodySchema
>;
export type BulkCreateExamTimetableEntriesBodyInput = z.infer<
  typeof bulkCreateExamTimetableEntriesBodySchema
>;
export type GenerateDraftExamTimetableEntriesBodyInput = z.infer<
  typeof generateDraftExamTimetableEntriesBodySchema
>;

export type GenerateDraftExamTimetableEntriesResult = {
  created: ExamTimetableEntryDTO[];
  skippedCount: number;
  createdCount: number;
};

export class ExamTimetableEntryServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamTimetableEntryServiceError";
    this.status = status;
  }
}

const MUTABLE_SESSION_STATUSES: ExamSessionStatus[] = [
  "draft",
  "scheduled",
  "conflict_review",
];

const EDITABLE_ENTRY_STATUSES: ExamTimetableEntryStatus[] = ["draft", "ready"];

function toObjectIds(values: string[]): Types.ObjectId[] {
  return values.map((value) => new Types.ObjectId(value));
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parseDate(value: z.infer<typeof dateInputSchema>): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ExamTimetableEntryServiceError("Invalid date value.");
  }
  return startOfDay(date);
}

function computeDurationMinutes(startTime: string, endTime: string): number {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    throw new ExamTimetableEntryServiceError("End time must be after start time.");
  }
  return endMinutes - startMinutes;
}

export function serializeExamTimetableEntry(doc: IExamTimetableEntry): ExamTimetableEntryDTO {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    examSessionId: String(doc.examSessionId),
    academicPeriodId: String(doc.academicPeriodId),
    title: doc.title ?? null,
    subjectId: String(doc.subjectId),
    gradeId: doc.gradeId ? String(doc.gradeId) : null,
    classGroupIds: doc.classGroupIds.map(String),
    date: doc.date.toISOString(),
    startTime: doc.startTime,
    endTime: doc.endTime,
    durationMinutes: doc.durationMinutes,
    venueId: doc.venueId ? String(doc.venueId) : null,
    roomLabel: doc.roomLabel ?? null,
    capacityRequired: doc.capacityRequired ?? null,
    assessmentItemId: doc.assessmentItemId ? String(doc.assessmentItemId) : null,
    contributesToReport: doc.contributesToReport,
    assessmentComponentKey: doc.assessmentComponentKey ?? null,
    maxScore: doc.maxScore ?? null,
    instructionsForInvigilators: doc.instructionsForInvigilators ?? null,
    instructionsForStudents: doc.instructionsForStudents ?? null,
    materialsAllowed: doc.materialsAllowed ?? [],
    specialNotes: doc.specialNotes ?? null,
    status: doc.status,
    isUnscheduled: doc.isUnscheduled ?? false,
    createdBy: String(doc.createdBy),
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function parseCreateExamTimetableEntryBody(body: unknown) {
  const parsed = examTimetableEntryBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseUpdateExamTimetableEntryBody(body: unknown) {
  const parsed = updateExamTimetableEntryBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseBulkCreateExamTimetableEntriesBody(body: unknown) {
  const parsed = bulkCreateExamTimetableEntriesBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseGenerateDraftExamTimetableEntriesBody(body: unknown) {
  const parsed = generateDraftExamTimetableEntriesBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

function minutesToEndTime(startTime: string, durationMinutes: number): string {
  const startMinutes = parseTimeToMinutes(startTime);
  if (startMinutes === null) {
    throw new ExamTimetableEntryServiceError("Invalid placeholder start time.");
  }
  const endMinutes = startMinutes + durationMinutes;
  const hours = Math.floor(endMinutes / 60) % 24;
  const minutes = endMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

async function loadMutableExamSession(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
}): Promise<IExamSession> {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamTimetableEntryServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!session) {
    throw new ExamTimetableEntryServiceError("Exam session not found.", 404);
  }

  if (!MUTABLE_SESSION_STATUSES.includes(session.status)) {
    throw new ExamTimetableEntryServiceError(
      "Timetable entries cannot be changed while the exam session is published or locked.",
      409
    );
  }

  return session;
}

async function assertSubjectOfferedForClassGroups(input: {
  schoolId: Types.ObjectId;
  subjectId: Types.ObjectId;
  classGroups: Array<{ _id: Types.ObjectId; gradeId: Types.ObjectId; subjectIds?: Types.ObjectId[] }>;
}) {
  for (const classGroup of input.classGroups) {
    const classSubjectIds = (classGroup.subjectIds ?? []).map(String);
    if (classSubjectIds.includes(String(input.subjectId))) {
      continue;
    }

    const offering = await SubjectOffering.findOne({
      schoolId: input.schoolId,
      subjectId: input.subjectId,
      isActive: true,
      gradeIds: classGroup.gradeId,
    }).select("_id");

    if (!offering) {
      throw new ExamTimetableEntryServiceError(
        "Subject is not offered for one or more selected class groups.",
        400
      );
    }
  }
}

async function validateEntryReferences(input: {
  schoolId: Types.ObjectId;
  session: IExamSession;
  body: CreateExamTimetableEntryBodyInput | UpdateExamTimetableEntryBodyInput;
  existing?: IExamTimetableEntry | null;
}) {
  const subjectId = input.body.subjectId ?? (input.existing ? String(input.existing.subjectId) : null);
  const classGroupIds =
    input.body.classGroupIds ??
    (input.existing ? input.existing.classGroupIds.map(String) : []);
  const dateValue =
    input.body.date ??
    (input.existing ? input.existing.date.toISOString().slice(0, 10) : null);
  const startTime = input.body.startTime ?? input.existing?.startTime;
  const endTime = input.body.endTime ?? input.existing?.endTime;
  const venueId =
    input.body.venueId !== undefined
      ? input.body.venueId
      : input.existing?.venueId
        ? String(input.existing.venueId)
        : null;

  if (!subjectId || classGroupIds.length === 0 || !dateValue || !startTime || !endTime) {
    throw new ExamTimetableEntryServiceError("Entry is missing required scheduling fields.", 400);
  }

  const subject = await Subject.findOne({ _id: subjectId, schoolId: input.schoolId }).select("_id");
  if (!subject) {
    throw new ExamTimetableEntryServiceError("Subject not found for this school.", 404);
  }

  const classGroups = await ClassGroup.find({
    _id: { $in: toObjectIds(classGroupIds) },
    schoolId: input.schoolId,
    isActive: true,
  }).select("_id gradeId subjectIds name");

  if (classGroups.length !== classGroupIds.length) {
    throw new ExamTimetableEntryServiceError(
      "One or more class groups are invalid or inactive.",
      400
    );
  }

  const sessionClassGroupIds = (input.session.appliesToClassGroupIds ?? []).map(String);
  const sessionGradeIds = (input.session.appliesToGradeIds ?? []).map(String);

  for (const classGroup of classGroups) {
    if (
      sessionClassGroupIds.length > 0 &&
      !sessionClassGroupIds.includes(String(classGroup._id))
    ) {
      throw new ExamTimetableEntryServiceError(
        "Class group is outside the exam session scope.",
        400
      );
    }
    if (
      sessionGradeIds.length > 0 &&
      !sessionGradeIds.includes(String(classGroup.gradeId))
    ) {
      throw new ExamTimetableEntryServiceError(
        "Class group grade is outside the exam session scope.",
        400
      );
    }
  }

  await assertSubjectOfferedForClassGroups({
    schoolId: input.schoolId,
    subjectId: new Types.ObjectId(subjectId),
    classGroups,
  });

  const entryDate = parseDate(dateValue);
  const sessionStart = startOfDay(input.session.startDate);
  const sessionEnd = startOfDay(input.session.endDate);
  if (entryDate < sessionStart || entryDate > sessionEnd) {
    throw new ExamTimetableEntryServiceError(
      "Exam date must fall within the exam session date range.",
      400
    );
  }

  computeDurationMinutes(startTime, endTime);

  if (venueId) {
    const venue = await ExamVenue.findOne({
      _id: venueId,
      schoolId: input.schoolId,
      isActive: true,
    }).select("_id");
    if (!venue) {
      throw new ExamTimetableEntryServiceError("Venue not found or inactive.", 404);
    }
  }

  const resolvedGradeId =
    input.body.gradeId ??
    (classGroups.length === 1 ? String(classGroups[0].gradeId) : input.existing?.gradeId
      ? String(input.existing.gradeId)
      : null);

  return {
    subjectId: new Types.ObjectId(subjectId),
    classGroupIds: toObjectIds(classGroupIds),
    gradeId: resolvedGradeId ? new Types.ObjectId(resolvedGradeId) : null,
    date: entryDate,
    startTime,
    endTime,
    durationMinutes: computeDurationMinutes(startTime, endTime),
    venueId: venueId ? new Types.ObjectId(venueId) : null,
  };
}

function buildEntryDocument(input: {
  schoolId: Types.ObjectId;
  session: IExamSession;
  actorId: Types.ObjectId;
  body: CreateExamTimetableEntryBodyInput;
  validated: Awaited<ReturnType<typeof validateEntryReferences>>;
}) {
  return {
    schoolId: input.schoolId,
    examSessionId: input.session._id,
    academicPeriodId: input.session.academicPeriodId,
    title: input.body.title ?? null,
    subjectId: input.validated.subjectId,
    gradeId: input.validated.gradeId,
    classGroupIds: input.validated.classGroupIds,
    date: input.validated.date,
    startTime: input.validated.startTime,
    endTime: input.validated.endTime,
    durationMinutes: input.validated.durationMinutes,
    venueId: input.validated.venueId,
    roomLabel: input.body.roomLabel ?? null,
    capacityRequired: input.body.capacityRequired ?? null,
    contributesToReport: input.body.contributesToReport ?? true,
    assessmentComponentKey: input.body.assessmentComponentKey ?? null,
    maxScore: input.body.maxScore ?? null,
    instructionsForInvigilators: input.body.instructionsForInvigilators ?? null,
    instructionsForStudents: input.body.instructionsForStudents ?? null,
    materialsAllowed: input.body.materialsAllowed ?? [],
    specialNotes: input.body.specialNotes ?? null,
    status: input.body.status ?? "draft",
    isUnscheduled: false,
    createdBy: input.actorId,
    updatedBy: input.actorId,
  };
}

export async function createExamTimetableEntry(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  body: CreateExamTimetableEntryBodyInput;
}) {
  const session = await loadMutableExamSession({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  });

  const validated = await validateEntryReferences({
    schoolId: input.schoolId,
    session,
    body: input.body,
  });

  const created = await ExamTimetableEntry.create(
    buildEntryDocument({
      schoolId: input.schoolId,
      session,
      actorId: input.actorId,
      body: input.body,
      validated,
    })
  );

  return serializeExamTimetableEntry(created);
}

export async function bulkCreateExamTimetableEntries(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  body: BulkCreateExamTimetableEntriesBodyInput;
}) {
  const session = await loadMutableExamSession({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  });

  const docs = [];
  for (const entryBody of input.body.entries) {
    const validated = await validateEntryReferences({
      schoolId: input.schoolId,
      session,
      body: entryBody,
    });
    docs.push(
      buildEntryDocument({
        schoolId: input.schoolId,
        session,
        actorId: input.actorId,
        body: entryBody,
        validated,
      })
    );
  }

  const created = await ExamTimetableEntry.insertMany(docs);
  return created.map(serializeExamTimetableEntry);
}

export async function listExamTimetableEntries(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  status?: string | null;
  classGroupId?: string | null;
  subjectId?: string | null;
  date?: string | null;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamTimetableEntryServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  }).select("_id");

  if (!session) {
    throw new ExamTimetableEntryServiceError("Exam session not found.", 404);
  }

  const filter: Record<string, unknown> = {
    schoolId: input.schoolId,
    examSessionId: input.sessionId,
  };

  if (input.status) filter.status = input.status;
  if (input.classGroupId && mongoose.Types.ObjectId.isValid(input.classGroupId)) {
    filter.classGroupIds = input.classGroupId;
  }
  if (input.subjectId && mongoose.Types.ObjectId.isValid(input.subjectId)) {
    filter.subjectId = input.subjectId;
  }
  if (input.date) {
    filter.date = parseDate(input.date);
  }

  const rows = await ExamTimetableEntry.find(filter).sort({ date: 1, startTime: 1 });
  return rows.map(serializeExamTimetableEntry);
}

export async function getExamTimetableEntryById(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  entryId: string;
}) {
  if (
    !mongoose.Types.ObjectId.isValid(input.sessionId) ||
    !mongoose.Types.ObjectId.isValid(input.entryId)
  ) {
    throw new ExamTimetableEntryServiceError("Invalid id.", 400);
  }

  const entry = await ExamTimetableEntry.findOne({
    _id: input.entryId,
    examSessionId: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!entry) {
    throw new ExamTimetableEntryServiceError("Exam timetable entry not found.", 404);
  }

  return serializeExamTimetableEntry(entry);
}

export async function updateExamTimetableEntry(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  entryId: string;
  body: UpdateExamTimetableEntryBodyInput;
}) {
  const session = await loadMutableExamSession({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  });

  if (!mongoose.Types.ObjectId.isValid(input.entryId)) {
    throw new ExamTimetableEntryServiceError("Invalid entry id.", 400);
  }

  const entry = await ExamTimetableEntry.findOne({
    _id: input.entryId,
    examSessionId: session._id,
    schoolId: input.schoolId,
  });

  if (!entry) {
    throw new ExamTimetableEntryServiceError("Exam timetable entry not found.", 404);
  }

  if (!EDITABLE_ENTRY_STATUSES.includes(entry.status)) {
    throw new ExamTimetableEntryServiceError(
      "Only draft or ready entries can be edited.",
      409
    );
  }

  const validated = await validateEntryReferences({
    schoolId: input.schoolId,
    session,
    body: input.body,
    existing: entry,
  });

  if (input.body.title !== undefined) entry.title = input.body.title;
  if (input.body.subjectId !== undefined) entry.subjectId = validated.subjectId;
  if (input.body.classGroupIds !== undefined) entry.classGroupIds = validated.classGroupIds;
  if (input.body.gradeId !== undefined || validated.gradeId) {
    entry.gradeId = validated.gradeId;
  }
  if (input.body.date !== undefined) entry.date = validated.date;
  if (input.body.startTime !== undefined) entry.startTime = validated.startTime;
  if (input.body.endTime !== undefined) entry.endTime = validated.endTime;
  entry.durationMinutes = validated.durationMinutes;
  if (input.body.venueId !== undefined) entry.venueId = validated.venueId;
  if (input.body.roomLabel !== undefined) entry.roomLabel = input.body.roomLabel;
  if (input.body.capacityRequired !== undefined) {
    entry.capacityRequired = input.body.capacityRequired;
  }
  if (input.body.contributesToReport !== undefined) {
    entry.contributesToReport = input.body.contributesToReport;
  }
  if (input.body.assessmentComponentKey !== undefined) {
    entry.assessmentComponentKey = input.body.assessmentComponentKey;
  }
  if (input.body.maxScore !== undefined) entry.maxScore = input.body.maxScore;
  if (input.body.instructionsForInvigilators !== undefined) {
    entry.instructionsForInvigilators = input.body.instructionsForInvigilators;
  }
  if (input.body.instructionsForStudents !== undefined) {
    entry.instructionsForStudents = input.body.instructionsForStudents;
  }
  if (input.body.materialsAllowed !== undefined) {
    entry.materialsAllowed = input.body.materialsAllowed;
  }
  if (input.body.specialNotes !== undefined) entry.specialNotes = input.body.specialNotes;
  if (input.body.status !== undefined) entry.status = input.body.status;

  if (
    entry.isUnscheduled &&
    (input.body.date !== undefined ||
      input.body.startTime !== undefined ||
      input.body.endTime !== undefined)
  ) {
    entry.isUnscheduled = false;
  }

  entry.updatedBy = input.actorId;
  await entry.save();

  return serializeExamTimetableEntry(entry);
}

export async function deleteDraftExamTimetableEntry(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  entryId: string;
}) {
  await loadMutableExamSession({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  });

  if (!mongoose.Types.ObjectId.isValid(input.entryId)) {
    throw new ExamTimetableEntryServiceError("Invalid entry id.", 400);
  }

  const entry = await ExamTimetableEntry.findOne({
    _id: input.entryId,
    examSessionId: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!entry) {
    throw new ExamTimetableEntryServiceError("Exam timetable entry not found.", 404);
  }

  if (entry.status !== "draft") {
    throw new ExamTimetableEntryServiceError("Only draft entries can be deleted.", 409);
  }

  await entry.deleteOne();
  return { deleted: true, id: input.entryId };
}

async function resolveSubjectIdsForClassGroup(input: {
  schoolId: Types.ObjectId;
  classGroup: { _id: Types.ObjectId; gradeId: Types.ObjectId; subjectIds?: Types.ObjectId[] };
  requestedSubjectIds: Types.ObjectId[];
}): Promise<Types.ObjectId[]> {
  const directSubjectIds = (input.classGroup.subjectIds ?? []).map((id) => String(id));

  const offeringSubjectIds = await SubjectOffering.find({
    schoolId: input.schoolId,
    isActive: true,
    gradeIds: input.classGroup.gradeId,
  })
    .select("subjectId")
    .lean();

  const allowed = new Set<string>([
    ...directSubjectIds,
    ...offeringSubjectIds.map((row) => String(row.subjectId)),
  ]);

  if (input.requestedSubjectIds.length > 0) {
    return input.requestedSubjectIds.filter((subjectId) => allowed.has(String(subjectId)));
  }

  return Array.from(allowed).map((id) => new Types.ObjectId(id));
}

async function hasDuplicateDraftEntry(input: {
  examSessionId: Types.ObjectId;
  subjectId: Types.ObjectId;
  classGroupId: Types.ObjectId;
}) {
  const existing = await ExamTimetableEntry.findOne({
    examSessionId: input.examSessionId,
    subjectId: input.subjectId,
    classGroupIds: [input.classGroupId],
  }).select("_id");

  return Boolean(existing);
}

export async function generateDraftExamTimetableEntries(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  body: GenerateDraftExamTimetableEntriesBodyInput;
}): Promise<GenerateDraftExamTimetableEntriesResult> {
  const session = await loadMutableExamSession({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  });

  const classGroups = await ClassGroup.find({
    _id: { $in: toObjectIds(input.body.classGroupIds) },
    schoolId: input.schoolId,
    isActive: true,
  }).select("_id gradeId subjectIds name");

  if (classGroups.length !== input.body.classGroupIds.length) {
    throw new ExamTimetableEntryServiceError(
      "One or more class groups are invalid or inactive.",
      400
    );
  }

  const sessionClassGroupIds = (session.appliesToClassGroupIds ?? []).map(String);
  const sessionGradeIds = (session.appliesToGradeIds ?? []).map(String);

  for (const classGroup of classGroups) {
    if (
      sessionClassGroupIds.length > 0 &&
      !sessionClassGroupIds.includes(String(classGroup._id))
    ) {
      throw new ExamTimetableEntryServiceError(
        "One or more class groups are outside the exam session scope.",
        400
      );
    }
    if (
      sessionGradeIds.length > 0 &&
      !sessionGradeIds.includes(String(classGroup.gradeId))
    ) {
      throw new ExamTimetableEntryServiceError(
        "One or more class groups are outside the exam session scope.",
        400
      );
    }
  }

  const requestedSubjectIds =
    input.body.subjectIds.length > 0
      ? toObjectIds(input.body.subjectIds)
      : [];

  if (requestedSubjectIds.length > 0) {
    const subjectCount = await Subject.countDocuments({
      _id: { $in: requestedSubjectIds },
      schoolId: input.schoolId,
    });
    if (subjectCount !== requestedSubjectIds.length) {
      throw new ExamTimetableEntryServiceError(
        "One or more subjects are invalid for this school.",
        400
      );
    }
  }

  const placeholderStartTime = "08:00";
  const placeholderEndTime = minutesToEndTime(
    placeholderStartTime,
    input.body.defaultDurationMinutes
  );
  const placeholderDate = startOfDay(session.startDate);

  const docs: Array<Record<string, unknown>> = [];
  let skippedCount = 0;

  for (const classGroup of classGroups) {
    const subjectIds = await resolveSubjectIdsForClassGroup({
      schoolId: input.schoolId,
      classGroup,
      requestedSubjectIds,
    });

    for (const subjectId of subjectIds) {
      const duplicate = await hasDuplicateDraftEntry({
        examSessionId: session._id,
        subjectId,
        classGroupId: classGroup._id,
      });
      if (duplicate) {
        skippedCount += 1;
        continue;
      }

      const subject = await Subject.findById(subjectId).select("name").lean();
      docs.push({
        schoolId: input.schoolId,
        examSessionId: session._id,
        academicPeriodId: session.academicPeriodId,
        title: subject?.name ? `${classGroup.name} ${subject.name}` : null,
        subjectId,
        gradeId: classGroup.gradeId,
        classGroupIds: [classGroup._id],
        date: placeholderDate,
        startTime: placeholderStartTime,
        endTime: placeholderEndTime,
        durationMinutes: input.body.defaultDurationMinutes,
        venueId: null,
        roomLabel: null,
        capacityRequired: null,
        contributesToReport: input.body.contributesToReport ?? true,
        assessmentComponentKey: input.body.assessmentComponentKey ?? "exam",
        maxScore: input.body.defaultMaxScore ?? null,
        instructionsForInvigilators: null,
        instructionsForStudents: null,
        materialsAllowed: [],
        specialNotes: null,
        status: "draft",
        isUnscheduled: true,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      });
    }
  }

  if (docs.length === 0) {
    return { created: [], skippedCount, createdCount: 0 };
  }

  const created = await ExamTimetableEntry.insertMany(docs);
  const serialized = created.map((doc) =>
    serializeExamTimetableEntry(doc as IExamTimetableEntry)
  );

  return {
    created: serialized,
    skippedCount,
    createdCount: serialized.length,
  };
}
