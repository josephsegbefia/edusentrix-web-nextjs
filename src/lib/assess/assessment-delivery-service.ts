import mongoose, { Types } from "mongoose";
import {
  AssessmentDeliveryVersion,
  type AssessmentDeliveryStatus,
  type IAssessmentDeliveryVersion,
} from "@/models/AssessmentDeliveryVersion";
import { AssessmentDefinitionVersion, type IAssessmentDefinitionVersion } from "@/models/AssessmentDefinitionVersion";
import { AssessmentItem } from "@/models/AssessmentItem";
import { AssessmentPlan } from "@/models/AssessmentPlan";
import { ExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { hashAssessmentDefinition } from "@/lib/assess/assessment-definition-service";

export class AssessmentDeliveryError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 503;

  constructor(message: string, status: 400 | 403 | 404 | 409 | 503 = 409) {
    super(message);
    this.name = "AssessmentDeliveryError";
    this.status = status;
  }
}

export type AssessmentDeliveryActor = {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  isAdmin: boolean;
  premiumPublicationEntitled: boolean;
};

export type AssessmentDeliveryScheduleInput = {
  examSessionId?: Types.ObjectId | null;
  examTimetableEntryId?: Types.ObjectId | null;
  scheduledDate?: Date | string | null;
  startTime?: string | null;
  endTime?: string | null;
  venueId?: Types.ObjectId | null;
  roomLabel?: string | null;
};

export type CreateAssessmentDeliveryDraftInput = {
  assessmentDefinitionVersionId: Types.ObjectId;
  actor: AssessmentDeliveryActor;
  title: string;
  durationMinutes?: number | null;
  lateEntryMinutes?: number;
  schedule?: AssessmentDeliveryScheduleInput;
  resultBinding: "none" | "score_bearing";
  assessmentPlanId?: Types.ObjectId | null;
  assessmentItemId?: Types.ObjectId | null;
  accessibilityPolicy?: {
    extraTimeMinutes?: number;
    largePrint?: boolean;
    readerOrScribe?: boolean;
    notes?: string | null;
  };
};

const TRANSACTION_OPTIONS = {
  readConcern: { level: "snapshot" as const },
  writeConcern: { w: "majority" as const },
  maxCommitTimeMS: 10_000,
};

const CURRENT_STATUSES: AssessmentDeliveryStatus[] = ["published", "active", "emergency_paused"];
const SCORE_BEARING_PLAN_STATUSES = new Set(["active", "locked"]);
const SCORE_BEARING_ITEM_STATUSES = new Set(["open", "completed", "submitted"]);
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function requiredObjectId(value: Types.ObjectId | string | null | undefined, label: string) {
  if (!value || !Types.ObjectId.isValid(String(value))) {
    throw new AssessmentDeliveryError(`${label} is invalid`, 400);
  }
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}

function sameId(left: Types.ObjectId | string | null | undefined, right: Types.ObjectId | string | null | undefined) {
  return Boolean(left && right && String(left) === String(right));
}

function parseDate(value: Date | string | null | undefined, label: string) {
  if (value == null) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new AssessmentDeliveryError(`${label} is invalid`, 400);
  return date;
}

function assertActor(actor: AssessmentDeliveryActor) {
  if (!actor.isAdmin) throw new AssessmentDeliveryError("Only school administrators can manage deliveries", 403);
  if (!actor.premiumPublicationEntitled) {
    throw new AssessmentDeliveryError("Premium Assess publication entitlement is required", 403);
  }
}

function assertTransition(current: AssessmentDeliveryStatus, next: AssessmentDeliveryStatus) {
  const allowed: Record<AssessmentDeliveryStatus, AssessmentDeliveryStatus[]> = {
    draft: ["review", "archived"],
    review: ["published", "draft", "archived"],
    published: ["active", "closed", "superseded"],
    active: ["emergency_paused", "closed", "superseded"],
    emergency_paused: ["active", "closed", "superseded"],
    closed: ["superseded", "archived"],
    superseded: ["archived"],
    archived: [],
  };
  if (!allowed[current].includes(next)) {
    throw new AssessmentDeliveryError(`Illegal assessment delivery transition: ${current} -> ${next}`);
  }
}

function transactionUnavailable(error: unknown) {
  const value = error as { code?: number; message?: string } | null;
  const message = String(value?.message ?? "").toLowerCase();
  return value?.code === 20 || value?.code === 303 ||
    message.includes("transaction numbers are only allowed") ||
    message.includes("transactions are not supported") ||
    message.includes("does not support transactions");
}

function transientTransaction(error: unknown) {
  const labels = (error as { errorLabels?: unknown } | null)?.errorLabels;
  return Array.isArray(labels) &&
    (labels.includes("TransientTransactionError") || labels.includes("UnknownTransactionCommitResult"));
}

function classGroupOverlap(left: Types.ObjectId[], right: Types.ObjectId[]) {
  return left.some((id) => right.some((other) => sameId(id, other)));
}

async function validateBinding(input: {
  definition: IAssessmentDefinitionVersion;
  resultBinding: "none" | "score_bearing";
  assessmentPlanId: Types.ObjectId | null;
  assessmentItemId: Types.ObjectId | null;
  schoolId: Types.ObjectId;
}) {
  if (input.resultBinding !== input.definition.resultBinding) {
    throw new AssessmentDeliveryError("Delivery binding must match the published assessment definition", 409);
  }
  if (input.resultBinding === "none") {
    if (input.assessmentPlanId || input.assessmentItemId) {
      throw new AssessmentDeliveryError("Non-reporting deliveries cannot include canonical bindings", 400);
    }
    return;
  }
  if (!input.assessmentPlanId || !input.assessmentItemId) {
    throw new AssessmentDeliveryError("Score-bearing delivery requires assessmentPlanId and assessmentItemId", 400);
  }
  if (!sameId(input.definition.assessmentPlanId, input.assessmentPlanId) ||
      !sameId(input.definition.assessmentItemId, input.assessmentItemId)) {
    throw new AssessmentDeliveryError("Delivery bindings must match the published definition bindings", 409);
  }
  const [plan, item] = await Promise.all([
    AssessmentPlan.findOne({ _id: input.assessmentPlanId, schoolId: input.schoolId }).lean(),
    AssessmentItem.findOne({ _id: input.assessmentItemId, schoolId: input.schoolId }).lean(),
  ]);
  if (!plan) throw new AssessmentDeliveryError("Assessment plan was not found for this school", 409);
  if (!item) throw new AssessmentDeliveryError("Assessment item was not found for this school", 409);
  if (!SCORE_BEARING_PLAN_STATUSES.has(plan.status) || !SCORE_BEARING_ITEM_STATUSES.has(item.status)) {
    throw new AssessmentDeliveryError("Canonical binding is not active for delivery", 409);
  }
  if (!sameId(item.assessmentPlanId, plan._id) || !sameId(item.subjectId, input.definition.subjectId) ||
      !sameId(item.academicPeriodId, input.definition.academicPeriodId) ||
      !sameId(item.gradeId, input.definition.gradeId) ||
      !input.definition.classGroupIds.some((id) => sameId(id, item.classGroupId))) {
    throw new AssessmentDeliveryError("Canonical binding does not match the published definition context", 409);
  }
}

async function prepareDraft(input: CreateAssessmentDeliveryDraftInput) {
  const definition = await AssessmentDefinitionVersion.findOne({
    _id: input.assessmentDefinitionVersionId,
    schoolId: input.actor.schoolId,
    status: "published",
  }).lean<IAssessmentDefinitionVersion>();
  if (!definition) throw new AssessmentDeliveryError("Published assessment definition not found", 404);

  const title = input.title.trim();
  if (!title) throw new AssessmentDeliveryError("Delivery title is required", 400);
  const scheduleInput = input.schedule ?? {};
  const timetable = scheduleInput.examTimetableEntryId
    ? await ExamTimetableEntry.findOne({
        _id: requiredObjectId(scheduleInput.examTimetableEntryId, "Exam timetable entry id"),
        schoolId: input.actor.schoolId,
      }).lean()
    : null;
  if (scheduleInput.examTimetableEntryId && !timetable) {
    throw new AssessmentDeliveryError("Exam timetable entry was not found for this school", 404);
  }
  const sessionId = scheduleInput.examSessionId ?? timetable?.examSessionId ?? null;
  const session = sessionId
    ? await ExamSession.findOne({ _id: requiredObjectId(sessionId, "Exam session id"), schoolId: input.actor.schoolId }).lean()
    : null;
  if (sessionId && !session) throw new AssessmentDeliveryError("Exam session was not found for this school", 404);
  if (timetable && session && !sameId(timetable.examSessionId, session._id)) {
    throw new AssessmentDeliveryError("Timetable entry does not belong to the selected exam session", 409);
  }
  if (timetable && (!sameId(timetable.subjectId, definition.subjectId) ||
      !sameId(timetable.academicPeriodId, definition.academicPeriodId) ||
      (timetable.gradeId && !sameId(timetable.gradeId, definition.gradeId)) ||
      (definition.classGroupIds.length > 0 && !classGroupOverlap(timetable.classGroupIds, definition.classGroupIds)))) {
    throw new AssessmentDeliveryError("Timetable entry does not match the published definition context", 409);
  }

  const academicPeriodId = requiredObjectId(definition.academicPeriodId, "Definition academic period id");
  const classGroupIds = (timetable?.classGroupIds ?? definition.classGroupIds).map((id) => requiredObjectId(id, "Class group id"));
  const durationMinutes = Number(input.durationMinutes ?? timetable?.durationMinutes ?? definition.durationMinutes ?? 0);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 720) {
    throw new AssessmentDeliveryError("A valid delivery duration is required", 400);
  }
  const scheduledDate = parseDate(timetable?.date ?? scheduleInput.scheduledDate, "Scheduled date");
  const startTime = timetable?.startTime ?? scheduleInput.startTime ?? null;
  const endTime = timetable?.endTime ?? scheduleInput.endTime ?? null;
  if ((startTime && !TIME_PATTERN.test(startTime)) || (endTime && !TIME_PATTERN.test(endTime))) {
    throw new AssessmentDeliveryError("Schedule times must use HH:MM format", 400);
  }
  const venueId = timetable?.venueId ?? scheduleInput.venueId ?? null;
  const normalizedVenueId = venueId ? requiredObjectId(venueId, "Venue id") : null;
  const assessmentPlanId = input.assessmentPlanId ?? null;
  const assessmentItemId = input.assessmentItemId ?? null;
  await validateBinding({
    definition,
    resultBinding: input.resultBinding,
    assessmentPlanId,
    assessmentItemId,
    schoolId: input.actor.schoolId,
  });

  const schedule = {
    examSessionId: session?._id ?? null,
    examTimetableEntryId: timetable?._id ?? null,
    academicPeriodId,
    scheduledDate,
    startTime,
    endTime,
    venueId: normalizedVenueId,
    roomLabel: timetable?.roomLabel ?? (scheduleInput.roomLabel?.trim() || null),
    classGroupIds,
  };
  const timing = {
    durationMinutes,
    lateEntryMinutes: Math.max(0, Math.min(720, Math.floor(input.lateEntryMinutes ?? 0))),
    serverAuthoritative: true,
  };
  const accessibilityPolicy = {
    extraTimeMinutes: Math.max(0, Math.min(720, Math.floor(input.accessibilityPolicy?.extraTimeMinutes ?? 0))),
    largePrint: Boolean(input.accessibilityPolicy?.largePrint),
    readerOrScribe: Boolean(input.accessibilityPolicy?.readerOrScribe),
    notes: input.accessibilityPolicy?.notes?.trim() || null,
  };
  const reviewPolicy = {
    reviewRequired: true as const,
    reviewerRole: "school_admin" as const,
    answerKeyAccess: "school_admin_only" as const,
    candidateAccess: "not_available" as const,
  };
  const deliveryKey = `assessment-definition:${String(definition._id)}:paper`;
  const contentHash = hashAssessmentDefinition({
    schemaVersion: 1,
    deliveryKey,
    assessmentDefinitionVersionId: definition._id,
    definitionContentHash: definition.contentHash,
    title,
    mode: "paper",
    academicYearId: definition.academicYearId,
    academicPeriodId,
    gradeId: definition.gradeId,
    classGroupIds,
    subjectId: definition.subjectId,
    subjectOfferingId: definition.subjectOfferingId ?? null,
    schedule,
    timing,
    resultBinding: input.resultBinding,
    assessmentPlanId,
    assessmentItemId,
    reviewPolicy,
    accessibilityPolicy,
  });
  return {
    definition,
    deliveryKey,
    definitionContentHash: definition.contentHash,
    title,
    mode: "paper" as const,
    academicYearId: requiredObjectId(definition.academicYearId, "Definition academic year id"),
    academicPeriodId,
    gradeId: requiredObjectId(definition.gradeId, "Definition grade id"),
    classGroupIds,
    subjectId: requiredObjectId(definition.subjectId, "Definition subject id"),
    subjectOfferingId: definition.subjectOfferingId ?? null,
    schedule,
    timing,
    resultBinding: input.resultBinding,
    assessmentPlanId,
    assessmentItemId,
    reviewPolicy,
    accessibilityPolicy,
    contentHash,
  };
}

async function reconcileByHash(input: { schoolId: Types.ObjectId; deliveryKey: string; contentHash: string }) {
  return AssessmentDeliveryVersion.findOne({
    schoolId: input.schoolId,
    deliveryKey: input.deliveryKey,
    contentHash: input.contentHash,
  }).lean<IAssessmentDeliveryVersion>();
}

export async function createAssessmentDeliveryDraft(input: CreateAssessmentDeliveryDraftInput) {
  assertActor(input.actor);
  const prepared = await prepareDraft(input);
  const existing = await reconcileByHash({
    schoolId: input.actor.schoolId,
    deliveryKey: prepared.deliveryKey,
    contentHash: prepared.contentHash,
  });
  if (existing) return { delivery: existing, replayed: true as const };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let session: mongoose.ClientSession | undefined;
    try {
      session = await mongoose.startSession();
      let created: IAssessmentDeliveryVersion | null = null;
      await session.withTransaction(async () => {
        const latest = await AssessmentDeliveryVersion.findOne({
          schoolId: input.actor.schoolId,
          deliveryKey: prepared.deliveryKey,
        }).sort({ version: -1 }).session(session!).lean();
        const [doc] = await AssessmentDeliveryVersion.create([{
          schoolId: input.actor.schoolId,
          deliveryKey: prepared.deliveryKey,
          assessmentDefinitionVersionId: prepared.definition._id,
          definitionContentHash: prepared.definitionContentHash,
          version: (latest?.version ?? 0) + 1,
          supersedesVersionId: null,
          title: prepared.title,
          mode: prepared.mode,
          academicYearId: prepared.academicYearId,
          academicPeriodId: prepared.academicPeriodId,
          gradeId: prepared.gradeId,
          classGroupIds: prepared.classGroupIds,
          subjectId: prepared.subjectId,
          subjectOfferingId: prepared.subjectOfferingId,
          schedule: prepared.schedule,
          timing: prepared.timing,
          resultBinding: prepared.resultBinding,
          assessmentPlanId: prepared.assessmentPlanId,
          assessmentItemId: prepared.assessmentItemId,
          reviewPolicy: prepared.reviewPolicy,
          accessibilityPolicy: prepared.accessibilityPolicy,
          contentHash: prepared.contentHash,
          contentHashAlgorithm: "sha256",
          status: "draft",
          attribution: {
            createdBy: input.actor.userId,
            reviewedBy: null,
            publishedBy: null,
            supersededBy: null,
          },
          reviewedAt: null,
          publishedAt: null,
          supersededAt: null,
          archivedAt: null,
        }], { session });
        created = doc.toObject() as IAssessmentDeliveryVersion;
      }, TRANSACTION_OPTIONS);
      if (!created) throw new AssessmentDeliveryError("Delivery draft transaction completed without a delivery", 409);
      return { delivery: created, replayed: false as const };
    } catch (error: unknown) {
      if (transactionUnavailable(error)) {
        throw new AssessmentDeliveryError("Atomic delivery creation requires a transaction-capable MongoDB deployment", 503);
      }
      const replay = await reconcileByHash({
        schoolId: input.actor.schoolId,
        deliveryKey: prepared.deliveryKey,
        contentHash: prepared.contentHash,
      });
      if (replay) return { delivery: replay, replayed: true as const };
      if ((error as { code?: number })?.code === 11000 || transientTransaction(error)) continue;
      throw error;
    } finally {
      await session?.endSession();
    }
  }
  throw new AssessmentDeliveryError("Could not allocate a delivery version safely", 409);
}

export async function submitAssessmentDeliveryForReview(input: {
  deliveryId: Types.ObjectId;
  actor: AssessmentDeliveryActor;
  expectedUpdatedAt?: Date | string | null;
}) {
  assertActor(input.actor);
  const delivery = await AssessmentDeliveryVersion.findOne({ _id: input.deliveryId, schoolId: input.actor.schoolId });
  if (!delivery) throw new AssessmentDeliveryError("Assessment delivery not found", 404);
  if (input.expectedUpdatedAt && delivery.updatedAt.getTime() !== parseDate(input.expectedUpdatedAt, "Expected delivery revision")!.getTime()) {
    throw new AssessmentDeliveryError("The delivery changed since it was loaded; refresh and retry", 409);
  }
  assertTransition(delivery.status, "review");
  delivery.status = "review";
  await delivery.save();
  return delivery.toObject() as IAssessmentDeliveryVersion;
}

export async function publishAssessmentDelivery(input: {
  deliveryId: Types.ObjectId;
  actor: AssessmentDeliveryActor;
  expectedCurrentVersionId?: Types.ObjectId | null;
}) {
  assertActor(input.actor);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let session: mongoose.ClientSession | undefined;
    try {
      session = await mongoose.startSession();
      let published: IAssessmentDeliveryVersion | null = null;
      await session.withTransaction(async () => {
        const target = await AssessmentDeliveryVersion.findOne({
          _id: input.deliveryId,
          schoolId: input.actor.schoolId,
        }).session(session!).lean<IAssessmentDeliveryVersion>();
        if (!target) throw new AssessmentDeliveryError("Assessment delivery not found", 404);
        if (target.status !== "review") {
          throw new AssessmentDeliveryError("Only reviewed delivery configurations can be published", 409);
        }
        assertTransition(target.status, "published");
        const latest = await AssessmentDeliveryVersion.findOne({
          schoolId: input.actor.schoolId,
          deliveryKey: target.deliveryKey,
        }).sort({ version: -1 }).session(session!).lean<IAssessmentDeliveryVersion>();
        if (!latest || !sameId(latest._id, target._id)) {
          throw new AssessmentDeliveryError("This delivery draft is stale; publish the latest version", 409);
        }
        const current = await AssessmentDeliveryVersion.findOne({
          schoolId: input.actor.schoolId,
          deliveryKey: target.deliveryKey,
          status: { $in: CURRENT_STATUSES },
        }).sort({ version: -1 }).session(session!).lean<IAssessmentDeliveryVersion>();
        if (!sameId(input.expectedCurrentVersionId, current?._id ?? null) && input.expectedCurrentVersionId) {
          throw new AssessmentDeliveryError("The current delivery changed; refresh and retry", 409);
        }
        if (!input.expectedCurrentVersionId && current) {
          throw new AssessmentDeliveryError("Publishing requires the current delivery version to be acknowledged", 409);
        }
        const now = new Date();
        const targetDoc = await AssessmentDeliveryVersion.findById(target._id).session(session!);
        if (!targetDoc) throw new AssessmentDeliveryError("Assessment delivery not found", 404);
        targetDoc.supersedesVersionId = current?._id ?? null;
        targetDoc.status = "published";
        targetDoc.reviewedAt = now;
        targetDoc.publishedAt = now;
        targetDoc.attribution.reviewedBy = input.actor.userId;
        targetDoc.attribution.publishedBy = input.actor.userId;
        await targetDoc.save({ session });
        if (current?._id) {
          const superseded = await AssessmentDeliveryVersion.updateOne(
            { _id: current._id, schoolId: input.actor.schoolId, deliveryKey: target.deliveryKey, status: { $in: CURRENT_STATUSES } },
            { $set: {
              status: "superseded",
              supersededAt: now,
              "attribution.supersededBy": input.actor.userId,
            } },
            { session }
          );
          if (superseded.matchedCount !== 1) {
            throw new AssessmentDeliveryError("The current delivery changed during publication; retry is required", 409);
          }
        }
        published = targetDoc.toObject() as IAssessmentDeliveryVersion;
      }, TRANSACTION_OPTIONS);
      if (!published) throw new AssessmentDeliveryError("Delivery publication transaction completed without a delivery", 409);
      return { delivery: published, replayed: false as const };
    } catch (error: unknown) {
      if (transactionUnavailable(error)) {
        throw new AssessmentDeliveryError("Atomic delivery publication requires a transaction-capable MongoDB deployment", 503);
      }
      const target = await AssessmentDeliveryVersion.findOne({ _id: input.deliveryId, schoolId: input.actor.schoolId }).lean<IAssessmentDeliveryVersion>();
      if (target?.status === "published") return { delivery: target, replayed: true as const };
      if (error instanceof AssessmentDeliveryError && error.message.includes("changed during publication")) continue;
      if (transientTransaction(error)) continue;
      throw error;
    } finally {
      await session?.endSession();
    }
  }
  throw new AssessmentDeliveryError("Could not publish the delivery safely", 409);
}

export async function getAssessmentDelivery(input: { schoolId: Types.ObjectId; deliveryId: Types.ObjectId }) {
  return AssessmentDeliveryVersion.findOne({ _id: input.deliveryId, schoolId: input.schoolId }).lean<IAssessmentDeliveryVersion>();
}

export async function listAssessmentDeliveryVersions(input: { schoolId: Types.ObjectId; assessmentDefinitionVersionId?: Types.ObjectId }) {
  const filter: Record<string, unknown> = { schoolId: input.schoolId };
  if (input.assessmentDefinitionVersionId) filter.assessmentDefinitionVersionId = input.assessmentDefinitionVersionId;
  return AssessmentDeliveryVersion.find(filter).sort({ deliveryKey: 1, version: -1 }).lean<IAssessmentDeliveryVersion[]>();
}

export async function listPublishedAssessmentDefinitions(schoolId: Types.ObjectId) {
  return AssessmentDefinitionVersion.find({ schoolId, status: "published" })
    .sort({ updatedAt: -1 })
    .select("_id sourceExamPaperId title version contentHash resultBinding assessmentPlanId assessmentItemId academicYearId academicPeriodId gradeId classGroupIds subjectId subjectOfferingId durationMinutes")
    .lean();
}

export function serializeAssessmentDelivery(delivery: IAssessmentDeliveryVersion) {
  return {
    id: String(delivery._id),
    schoolId: String(delivery.schoolId),
    deliveryKey: delivery.deliveryKey,
    assessmentDefinitionVersionId: String(delivery.assessmentDefinitionVersionId),
    definitionContentHash: delivery.definitionContentHash,
    version: delivery.version,
    supersedesVersionId: delivery.supersedesVersionId ? String(delivery.supersedesVersionId) : null,
    title: delivery.title,
    mode: delivery.mode,
    academicYearId: String(delivery.academicYearId),
    academicPeriodId: String(delivery.academicPeriodId),
    gradeId: String(delivery.gradeId),
    classGroupIds: delivery.classGroupIds.map(String),
    subjectId: String(delivery.subjectId),
    subjectOfferingId: delivery.subjectOfferingId ? String(delivery.subjectOfferingId) : null,
    schedule: {
      ...delivery.schedule,
      examSessionId: delivery.schedule.examSessionId ? String(delivery.schedule.examSessionId) : null,
      examTimetableEntryId: delivery.schedule.examTimetableEntryId ? String(delivery.schedule.examTimetableEntryId) : null,
      academicPeriodId: String(delivery.schedule.academicPeriodId),
      venueId: delivery.schedule.venueId ? String(delivery.schedule.venueId) : null,
      classGroupIds: delivery.schedule.classGroupIds.map(String),
      scheduledDate: delivery.schedule.scheduledDate?.toISOString?.() ?? null,
    },
    timing: delivery.timing,
    resultBinding: delivery.resultBinding,
    assessmentPlanId: delivery.assessmentPlanId ? String(delivery.assessmentPlanId) : null,
    assessmentItemId: delivery.assessmentItemId ? String(delivery.assessmentItemId) : null,
    reviewPolicy: delivery.reviewPolicy,
    accessibilityPolicy: delivery.accessibilityPolicy,
    contentHash: delivery.contentHash,
    contentHashAlgorithm: delivery.contentHashAlgorithm,
    status: delivery.status,
    attribution: {
      createdBy: String(delivery.attribution.createdBy),
      reviewedBy: delivery.attribution.reviewedBy ? String(delivery.attribution.reviewedBy) : null,
      publishedBy: delivery.attribution.publishedBy ? String(delivery.attribution.publishedBy) : null,
      supersededBy: delivery.attribution.supersededBy ? String(delivery.attribution.supersededBy) : null,
    },
    createdAt: delivery.createdAt.toISOString(),
    updatedAt: delivery.updatedAt.toISOString(),
    reviewedAt: delivery.reviewedAt?.toISOString?.() ?? null,
    publishedAt: delivery.publishedAt?.toISOString?.() ?? null,
    supersededAt: delivery.supersededAt?.toISOString?.() ?? null,
  };
}

export function serializeAssessmentDefinitionSummary(definition: Record<string, unknown>) {
  return {
    id: String(definition._id),
    sourceExamPaperId: String(definition.sourceExamPaperId),
    title: String(definition.title),
    version: Number(definition.version),
    contentHash: String(definition.contentHash),
    resultBinding: definition.resultBinding,
    assessmentPlanId: definition.assessmentPlanId ? String(definition.assessmentPlanId) : null,
    assessmentItemId: definition.assessmentItemId ? String(definition.assessmentItemId) : null,
    academicYearId: String(definition.academicYearId),
    academicPeriodId: String(definition.academicPeriodId),
    gradeId: String(definition.gradeId),
    classGroupIds: ((definition.classGroupIds as Types.ObjectId[] | undefined) ?? []).map(String),
    subjectId: String(definition.subjectId),
    subjectOfferingId: definition.subjectOfferingId ? String(definition.subjectOfferingId) : null,
    durationMinutes: definition.durationMinutes ?? null,
  };
}
