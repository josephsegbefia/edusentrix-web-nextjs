import { createHash } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { AssessmentDefinitionVersion, type AssessmentDefinitionStatus, type IAssessmentDefinitionAttachmentSnapshot, type IAssessmentDefinitionQuestionSnapshot, type IAssessmentDefinitionResourceManifestEntry, type IAssessmentDefinitionSectionSnapshot, type IAssessmentDefinitionVersion } from "@/models/AssessmentDefinitionVersion";
import { AssessmentItem } from "@/models/AssessmentItem";
import { AssessmentPlan } from "@/models/AssessmentPlan";
import { ExamPaper } from "@/models/ExamPaper";
import { ExamPaperSection } from "@/models/ExamPaperSection";
import { ExamQuestion } from "@/models/ExamQuestion";

export type AssessmentDefinitionActor = {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  isAdmin: boolean;
  premiumPublicationEntitled: boolean;
};

export class AssessmentDefinitionError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 503;

  constructor(message: string, status: 400 | 403 | 404 | 409 | 503 = 409) {
    super(message);
    this.name = "AssessmentDefinitionError";
    this.status = status;
  }
}

const PUBLICATION_TRANSACTION_OPTIONS = {
  readConcern: { level: "snapshot" as const },
  writeConcern: { w: "majority" as const },
  maxCommitTimeMS: 10_000,
};

function isTransactionUnavailable(error: unknown) {
  const value = error as { code?: number; message?: string } | null;
  const message = String(value?.message ?? "").toLowerCase();
  return value?.code === 20 ||
    value?.code === 303 ||
    message.includes("transaction numbers are only allowed") ||
    message.includes("transactions are not supported") ||
    message.includes("does not support transactions");
}

function hasTransientTransactionLabel(error: unknown) {
  const value = error as { errorLabels?: unknown } | null;
  return Array.isArray(value?.errorLabels) &&
    (value.errorLabels.includes("TransientTransactionError") ||
      value.errorLabels.includes("UnknownTransactionCommitResult"));
}

type PublishAssessmentDefinitionInput = {
  examPaperId: Types.ObjectId;
  actor: AssessmentDefinitionActor;
  resultBinding: "none" | "score_bearing";
  assessmentPlanId?: Types.ObjectId | null;
  assessmentItemId?: Types.ObjectId | null;
};

const PUBLISHABLE_SOURCE_STATUSES = new Set(["approved", "printed", "completed"]);
const SCORE_BEARING_PLAN_STATUSES = new Set(["active", "locked"]);
const SCORE_BEARING_ITEM_STATUSES = new Set(["open", "completed", "submitted"]);

function sameId(left: Types.ObjectId | string, right: Types.ObjectId | string) {
  return String(left) === String(right);
}

function requiredObjectId(value: Types.ObjectId | string | null | undefined, label: string) {
  if (!value || !Types.ObjectId.isValid(String(value))) {
    throw new AssessmentDefinitionError(`${label} is invalid`, 400);
  }
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}

function toNullableObjectId(value: Types.ObjectId | string | null | undefined) {
  if (!value) return null;
  return requiredObjectId(value, "Object id");
}

function nullableString(value: string | null | undefined) {
  return value == null ? null : String(value);
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Types.ObjectId) return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

export function deterministicAssessmentDefinitionJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function hashAssessmentDefinition(value: unknown) {
  return createHash("sha256")
    .update(deterministicAssessmentDefinitionJson(value))
    .digest("hex");
}

export function assertLegalAssessmentDefinitionTransition(
  current: AssessmentDefinitionStatus,
  next: AssessmentDefinitionStatus
) {
  const allowed: Record<AssessmentDefinitionStatus, AssessmentDefinitionStatus[]> = {
    draft: ["review", "archived"],
    review: ["approved", "draft", "archived"],
    approved: ["published", "review", "archived"],
    published: ["superseded"],
    superseded: ["archived"],
    archived: [],
  };
  if (!allowed[current].includes(next)) {
    throw new AssessmentDefinitionError(
      `Illegal assessment definition transition: ${current} -> ${next}`
    );
  }
}

function assertPublicationActor(actor: AssessmentDefinitionActor) {
  if (!actor.isAdmin) {
    throw new AssessmentDefinitionError("Only school administrators can publish assessment definitions", 403);
  }
  if (!actor.premiumPublicationEntitled) {
    throw new AssessmentDefinitionError("Premium publication entitlement is required", 403);
  }
}

function attachmentResource(
  questionId: Types.ObjectId,
  attachment: IAssessmentDefinitionAttachmentSnapshot
): IAssessmentDefinitionResourceManifestEntry {
  const url = attachment.url.trim();
  const uploadKey = attachment.uploadKey?.trim() || null;
  if (!attachment.id.trim() || !url) {
    throw new AssessmentDefinitionError("Question has a missing source resource reference", 409);
  }

  let validUrl = false;
  try {
    const parsed = new URL(url);
    validUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    validUrl = url.startsWith("/");
  }
  if (!validUrl || (uploadKey && /\s/.test(uploadKey))) {
    throw new AssessmentDefinitionError("Question has an invalid source resource reference", 409);
  }

  return {
    resourceId: `question:${String(questionId)}:attachment:${attachment.id}`,
    sourceQuestionId: questionId,
    sourceAttachmentId: attachment.id,
    type: attachment.type,
    sourceUrl: url,
    uploadKey,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    visibility: "private",
    integrityAlgorithm: "sha256",
    integrityDigest: null,
    integrityStatus: "unverified",
  };
}

function snapshotAttachment(attachment: Record<string, unknown>): IAssessmentDefinitionAttachmentSnapshot {
  return {
    id: String(attachment.id ?? ""),
    type: String(attachment.type ?? ""),
    url: String(attachment.url ?? ""),
    uploadKey: nullableString(attachment.uploadKey as string | null | undefined),
    fileName: nullableString(attachment.fileName as string | null | undefined),
    mimeType: nullableString(attachment.mimeType as string | null | undefined),
    caption: nullableString(attachment.caption as string | null | undefined),
    altText: nullableString(attachment.altText as string | null | undefined),
    displayMode: String(attachment.displayMode ?? "above_question"),
  };
}

function snapshotQuestion(question: Record<string, unknown>): IAssessmentDefinitionQuestionSnapshot {
  const options = Array.isArray(question.options)
    ? question.options.map((option) => {
        const value = option as Record<string, unknown>;
        return {
          id: String(value.id ?? ""),
          label: String(value.label ?? ""),
          text: String(value.text ?? ""),
          isCorrect: Boolean(value.isCorrect),
        };
      })
    : [];
  const subQuestions = Array.isArray(question.subQuestions)
    ? question.subQuestions.map((subQuestion) => {
        const value = subQuestion as Record<string, unknown>;
        return {
          label: String(value.label ?? ""),
          prompt: String(value.prompt ?? ""),
          marks: Number(value.marks ?? 0),
          expectedAnswer: nullableString(value.expectedAnswer as string | null | undefined),
          markingGuide: nullableString(value.markingGuide as string | null | undefined),
        };
      })
    : [];
  const attachments = Array.isArray(question.attachments)
    ? question.attachments.map((attachment) => snapshotAttachment(attachment as Record<string, unknown>))
    : [];

  return {
    sourceQuestionId: requiredObjectId(question._id as Types.ObjectId, "Source question id"),
    sourceQuestionBankItemId: toNullableObjectId(question.questionBankItemId as Types.ObjectId | null | undefined),
    sectionId: toNullableObjectId(question.sectionId as Types.ObjectId | null | undefined),
    order: Number(question.order ?? 0),
    type: String(question.type ?? ""),
    prompt: String(question.prompt ?? ""),
    plainTextPrompt: nullableString(question.plainTextPrompt as string | null | undefined),
    options,
    subQuestions,
    marks: Number(question.marks ?? 0),
    difficulty: String(question.difficulty ?? "medium"),
    topic: nullableString(question.topic as string | null | undefined),
    subtopic: nullableString(question.subtopic as string | null | undefined),
    curriculumNodeIds: ((question.curriculumNodeIds as Types.ObjectId[] | undefined) ?? []).map((id) => requiredObjectId(id, "Curriculum node id")),
    schemeItemIds: ((question.schemeItemIds as Types.ObjectId[] | undefined) ?? []).map((id) => requiredObjectId(id, "Scheme item id")),
    lessonIds: ((question.lessonIds as Types.ObjectId[] | undefined) ?? []).map((id) => requiredObjectId(id, "Lesson id")),
    lessonNoteIds: ((question.lessonNoteIds as Types.ObjectId[] | undefined) ?? []).map((id) => requiredObjectId(id, "Lesson note id")),
    expectedAnswer: nullableString(question.expectedAnswer as string | null | undefined),
    markingGuide: nullableString(question.markingGuide as string | null | undefined),
    explanation: nullableString(question.explanation as string | null | undefined),
    attachments,
  };
}

async function buildSourceSnapshot(input: {
  paper: Record<string, unknown>;
  sections: Array<Record<string, unknown>>;
  questions: Array<Record<string, unknown>>;
}) {
  if (input.questions.length === 0) {
    throw new AssessmentDefinitionError("An assessment definition requires at least one source question", 409);
  }

  const sectionOrder = new Map(input.sections.map((section, index) => [String(section._id), index]));
  const sortedSections = [...input.sections].sort(
    (left, right) => Number(left.order ?? 0) - Number(right.order ?? 0) || String(left._id).localeCompare(String(right._id))
  );
  const sortedQuestions = [...input.questions].sort((left, right) => {
    const leftSection = sectionOrder.get(String(left.sectionId)) ?? Number.MAX_SAFE_INTEGER;
    const rightSection = sectionOrder.get(String(right.sectionId)) ?? Number.MAX_SAFE_INTEGER;
    return leftSection - rightSection || Number(left.order ?? 0) - Number(right.order ?? 0) || String(left._id).localeCompare(String(right._id));
  });
  const knownSectionIds = new Set(sortedSections.map((section) => String(section._id)));
  const sections: IAssessmentDefinitionSectionSnapshot[] = sortedSections.map((section) => ({
    sourceSectionId: requiredObjectId(section._id as Types.ObjectId, "Source section id"),
    title: String(section.title ?? ""),
    instructions: nullableString(section.instructions as string | null | undefined),
    order: Number(section.order ?? 0),
    marks: Number(section.marks ?? 0),
    questions: [],
  }));
  const unsectioned: IAssessmentDefinitionQuestionSnapshot[] = [];

  for (const question of sortedQuestions) {
    if (question.sectionId && !knownSectionIds.has(String(question.sectionId))) {
      throw new AssessmentDefinitionError("Source question references a section outside the source paper", 409);
    }
    const snapshot = snapshotQuestion(question);
    for (const attachment of snapshot.attachments) {
      // The legacy authoring attachment shape contains only presentation
      // references. It does not prove StoredAsset ownership, readiness,
      // private access, or a stable provider digest. Do not publish a
      // resource-bearing immutable definition until those facts are available.
      attachmentResource(snapshot.sourceQuestionId, attachment);
      throw new AssessmentDefinitionError(
        "Resource-bearing publication requires verified private asset metadata and a stable resource digest",
        409
      );
    }
    const sectionIndex = sections.findIndex((section) => sameId(section.sourceSectionId, snapshot.sectionId as Types.ObjectId));
    if (sectionIndex < 0) unsectioned.push(snapshot);
    else sections[sectionIndex].questions.push(snapshot);
  }

  if (unsectioned.length > 0) {
    sections.push({
      sourceSectionId: new Types.ObjectId(),
      title: "Unsectioned questions",
      instructions: null,
      order: sections.length,
      marks: unsectioned.reduce((total, question) => total + question.marks, 0),
      questions: unsectioned,
    });
  }

  const questionMarksTotal = sortedQuestions.reduce((total, question) => total + Number(question.marks ?? 0), 0);
  const maximumMarks = Number(input.paper.totalMarks ?? 0);
  if (!Number.isFinite(maximumMarks) || maximumMarks < 0 || maximumMarks !== questionMarksTotal) {
    throw new AssessmentDefinitionError("Source paper maximum marks do not match its question marks", 409);
  }

  const resourceManifest = sections.flatMap((section) =>
    section.questions.flatMap((question) =>
      question.attachments.map((attachment) => attachmentResource(question.sourceQuestionId, attachment))
    )
  );
  return { sections, resourceManifest, maximumMarks, questionMarksTotal };
}

async function validateResultBinding(input: {
  paper: Record<string, unknown>;
  resultBinding: "none" | "score_bearing";
  assessmentPlanId?: Types.ObjectId | null;
  assessmentItemId?: Types.ObjectId | null;
  schoolId: Types.ObjectId;
}) {
  if (input.resultBinding === "none") {
    if (input.assessmentPlanId || input.assessmentItemId) {
      throw new AssessmentDefinitionError("Non-reporting definitions cannot include canonical plan or item bindings", 400);
    }
    return { assessmentPlanId: null, assessmentItemId: null };
  }
  if (!input.assessmentPlanId || !input.assessmentItemId) {
    throw new AssessmentDefinitionError("Score-bearing publication requires assessmentPlanId and assessmentItemId", 400);
  }

  const [plan, item] = await Promise.all([
    AssessmentPlan.findOne({ _id: input.assessmentPlanId, schoolId: input.schoolId }).lean(),
    AssessmentItem.findOne({ _id: input.assessmentItemId, schoolId: input.schoolId }).lean(),
  ]);
  if (!plan) throw new AssessmentDefinitionError("Assessment plan was not found for this school", 409);
  if (!item) throw new AssessmentDefinitionError("Assessment item was not found for this school", 409);
  if (!SCORE_BEARING_PLAN_STATUSES.has(plan.status)) {
    throw new AssessmentDefinitionError("Assessment plan is not active for score-bearing publication", 409);
  }
  if (!SCORE_BEARING_ITEM_STATUSES.has(item.status)) {
    throw new AssessmentDefinitionError("Assessment item is not active for score-bearing publication", 409);
  }
  if (!sameId(item.assessmentPlanId, plan._id)) {
    throw new AssessmentDefinitionError("Assessment item does not belong to the selected assessment plan", 409);
  }
  if (!sameId(item.subjectId, input.paper.subjectId as Types.ObjectId)) {
    throw new AssessmentDefinitionError("Assessment item subject does not match the source paper", 409);
  }
  if (input.paper.academicPeriodId && !sameId(item.academicPeriodId, input.paper.academicPeriodId as Types.ObjectId)) {
    throw new AssessmentDefinitionError("Assessment item academic period does not match the source paper", 409);
  }
  if (!sameId(item.gradeId, input.paper.gradeId as Types.ObjectId)) {
    throw new AssessmentDefinitionError("Assessment item grade does not match the source paper", 409);
  }
  if (!((input.paper.classGroupIds as Types.ObjectId[] | undefined) ?? []).some((id) => sameId(id, item.classGroupId))) {
    throw new AssessmentDefinitionError("Assessment item class group does not match the source paper", 409);
  }
  return { assessmentPlanId: plan._id, assessmentItemId: item._id };
}

function publicationHashPayload(input: {
  paper: Record<string, unknown>;
  sections: IAssessmentDefinitionSectionSnapshot[];
  resourceManifest: IAssessmentDefinitionResourceManifestEntry[];
  resultBinding: "none" | "score_bearing";
  assessmentPlanId: Types.ObjectId | null;
  assessmentItemId: Types.ObjectId | null;
  maximumMarks: number;
  questionMarksTotal: number;
}) {
  return {
    schemaVersion: 1,
    sourceExamPaperId: input.paper._id,
    title: input.paper.title,
    examTypeId: input.paper.examTypeId,
    academicYearId: input.paper.academicYearId,
    termId: input.paper.termId ?? null,
    academicPeriodId: input.paper.academicPeriodId ?? null,
    scope: input.paper.scope,
    gradeId: input.paper.gradeId,
    classGroupIds: input.paper.classGroupIds ?? [],
    subjectId: input.paper.subjectId,
    subjectOfferingId: input.paper.subjectOfferingId ?? null,
    durationMinutes: input.paper.durationMinutes ?? null,
    instructions: input.paper.instructions ?? null,
    candidateInstructions: input.paper.candidateInstructions ?? null,
    resultBinding: input.resultBinding,
    assessmentPlanId: input.assessmentPlanId,
    assessmentItemId: input.assessmentItemId,
    scoring: { maximumMarks: input.maximumMarks, questionMarksTotal: input.questionMarksTotal, policy: "raw_marks" },
    sections: input.sections,
    resourceManifest: input.resourceManifest,
  };
}

export async function publishAssessmentDefinition(input: PublishAssessmentDefinitionInput) {
  assertPublicationActor(input.actor);
  requiredObjectId(input.examPaperId, "Exam paper id");

  const paper = await ExamPaper.findOne({
    _id: input.examPaperId,
    schoolId: input.actor.schoolId,
  }).lean<Record<string, unknown>>();
  if (!paper) throw new AssessmentDefinitionError("Exam paper not found", 404);
  if (!PUBLISHABLE_SOURCE_STATUSES.has(String(paper.status))) {
    throw new AssessmentDefinitionError("Only approved exam papers can be published", 409);
  }
  if (!paper.approvedBy) {
    throw new AssessmentDefinitionError("Approved source paper is missing reviewer attribution", 409);
  }

  const [sections, questions, binding] = await Promise.all([
    ExamPaperSection.find({ schoolId: input.actor.schoolId, examPaperId: input.examPaperId })
      .sort({ order: 1, createdAt: 1, _id: 1 })
      .lean<Record<string, unknown>[]>(),
    ExamQuestion.find({ schoolId: input.actor.schoolId, examPaperId: input.examPaperId })
      .sort({ order: 1, createdAt: 1, _id: 1 })
      .lean<Record<string, unknown>[]>(),
    validateResultBinding({
      paper,
      resultBinding: input.resultBinding,
      assessmentPlanId: input.assessmentPlanId,
      assessmentItemId: input.assessmentItemId,
      schoolId: input.actor.schoolId,
    }),
  ]);
  const snapshot = await buildSourceSnapshot({ paper, sections, questions });
  const hashPayload = publicationHashPayload({
    paper,
    ...snapshot,
    resultBinding: input.resultBinding,
    ...binding,
  });
  const contentHash = hashAssessmentDefinition(hashPayload);
  const definitionKey = `exam-paper:${String(paper._id)}`;

  const existing = await AssessmentDefinitionVersion.findOne({
    schoolId: input.actor.schoolId,
    definitionKey,
    contentHash,
  }).lean();
  if (existing) return { definition: existing, replayed: true as const };

  const definitionPayload = {
    schoolId: input.actor.schoolId,
    definitionKey,
    sourceExamPaperId: paper._id,
    status: "published" as const,
    title: paper.title,
    examTypeId: paper.examTypeId,
    academicYearId: paper.academicYearId,
    termId: paper.termId ?? null,
    academicPeriodId: paper.academicPeriodId ?? null,
    scope: paper.scope,
    gradeId: paper.gradeId,
    classGroupIds: paper.classGroupIds ?? [],
    subjectId: paper.subjectId,
    subjectOfferingId: paper.subjectOfferingId ?? null,
    durationMinutes: paper.durationMinutes ?? null,
    instructions: paper.instructions ?? null,
    candidateInstructions: paper.candidateInstructions ?? null,
    resultBinding: input.resultBinding,
    assessmentPlanId: binding.assessmentPlanId,
    assessmentItemId: binding.assessmentItemId,
    scoring: {
      maximumMarks: snapshot.maximumMarks,
      questionMarksTotal: snapshot.questionMarksTotal,
      policy: "raw_marks" as const,
      scoreBearing: input.resultBinding === "score_bearing",
      contributesToCanonicalAcademicEngine: input.resultBinding === "score_bearing",
    },
    sections: snapshot.sections,
    resourceManifest: snapshot.resourceManifest,
    contentHash,
    contentHashAlgorithm: "sha256" as const,
    attribution: {
      authorId: paper.createdBy,
      reviewerId: paper.approvedBy,
      publisherId: input.actor.userId,
    },
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let session: mongoose.ClientSession | undefined;
    try {
      session = await mongoose.startSession();
      let committedDefinition: IAssessmentDefinitionVersion | null = null;

      await session.withTransaction(async () => {
        const [latest, current] = await Promise.all([
          AssessmentDefinitionVersion.findOne({
            schoolId: input.actor.schoolId,
            definitionKey,
          })
            .sort({ version: -1 })
            .session(session!)
            .lean(),
          AssessmentDefinitionVersion.findOne({
            schoolId: input.actor.schoolId,
            definitionKey,
            status: "published",
          })
            .sort({ version: -1 })
            .session(session!)
            .lean(),
        ]);
        const now = new Date();
        const [created] = await AssessmentDefinitionVersion.create(
          [{
            ...definitionPayload,
            version: (latest?.version ?? 0) + 1,
            supersedesVersionId: current?._id ?? null,
            publishedAt: now,
          }],
          { session }
        );

        if (current?._id) {
          const supersession = await AssessmentDefinitionVersion.updateOne(
            {
              _id: current._id,
              schoolId: input.actor.schoolId,
              definitionKey,
              status: "published",
            },
            { $set: { status: "superseded", supersededAt: now } },
            { session }
          );
          if (supersession.matchedCount !== 1) {
            throw new AssessmentDefinitionError(
              "The current assessment version changed during publication; retry is required",
              409
            );
          }
        }
        committedDefinition = created.toObject() as IAssessmentDefinitionVersion;
      }, PUBLICATION_TRANSACTION_OPTIONS);

      if (!committedDefinition) {
        throw new Error("Assessment publication transaction completed without a definition");
      }
      return { definition: committedDefinition, replayed: false as const };
    } catch (error: unknown) {
      if (isTransactionUnavailable(error)) {
        throw new AssessmentDefinitionError(
          "Atomic assessment publication requires a transaction-capable MongoDB deployment",
          503
        );
      }

      // A commit acknowledgement can be ambiguous. Reconcile only by the
      // stable school/definition/content identity; never retry blindly.
      const replay = await AssessmentDefinitionVersion.findOne({
        schoolId: input.actor.schoolId,
        definitionKey,
        contentHash,
      }).lean();
      if (replay) return { definition: replay, replayed: true as const };

      const code = (error as { code?: number })?.code;
      const stalePredecessor = error instanceof AssessmentDefinitionError &&
        error.message.includes("changed during publication");
      if (code === 11000 || stalePredecessor || hasTransientTransactionLabel(error)) continue;
      throw error;
    } finally {
      await session?.endSession();
    }
  }

  throw new AssessmentDefinitionError("Could not allocate a publication version safely", 409);
}

export async function getAssessmentDefinition(input: {
  schoolId: Types.ObjectId;
  definitionId: Types.ObjectId;
}) {
  return AssessmentDefinitionVersion.findOne({
    _id: input.definitionId,
    schoolId: input.schoolId,
  }).lean();
}

/**
 * Current means the highest-numbered version that is still published. The
 * version number supplies a total order even if a failed compensation leaves
 * more than one published row awaiting operational reconciliation.
 */
export async function getCurrentAssessmentDefinitionVersion(input: {
  schoolId: Types.ObjectId;
  definitionKey: string;
}) {
  return AssessmentDefinitionVersion.findOne({
    schoolId: input.schoolId,
    definitionKey: input.definitionKey,
    status: "published",
  })
    .sort({ version: -1 })
    .lean();
}

export async function listAssessmentDefinitionVersions(input: {
  schoolId: Types.ObjectId;
  sourceExamPaperId: Types.ObjectId;
}) {
  return AssessmentDefinitionVersion.find({
    schoolId: input.schoolId,
    sourceExamPaperId: input.sourceExamPaperId,
  })
    .sort({ version: -1 })
    .lean();
}

export function serializeAssessmentDefinition(
  definition: IAssessmentDefinitionVersion,
  options: { includePrivateContent?: boolean } = {}
) {
  const includePrivateContent = options.includePrivateContent ?? false;
  return {
    id: String(definition._id),
    schoolId: String(definition.schoolId),
    sourceExamPaperId: String(definition.sourceExamPaperId),
    version: definition.version,
    status: definition.status,
    title: definition.title,
    resultBinding: definition.resultBinding,
    assessmentPlanId: definition.assessmentPlanId ? String(definition.assessmentPlanId) : null,
    assessmentItemId: definition.assessmentItemId ? String(definition.assessmentItemId) : null,
    scoring: definition.scoring,
    contentHash: definition.contentHash,
    contentHashAlgorithm: definition.contentHashAlgorithm,
    supersedesVersionId: definition.supersedesVersionId ? String(definition.supersedesVersionId) : null,
    attribution: {
      authorId: String(definition.attribution.authorId),
      reviewerId: String(definition.attribution.reviewerId),
      publisherId: String(definition.attribution.publisherId),
    },
    sections: definition.sections.map((section) => ({
      sourceSectionId: String(section.sourceSectionId),
      title: section.title,
      instructions: section.instructions,
      order: section.order,
      marks: section.marks,
      questions: section.questions.map((question) => ({
        sourceQuestionId: String(question.sourceQuestionId),
        order: question.order,
        type: question.type,
        prompt: question.prompt,
        plainTextPrompt: question.plainTextPrompt,
        marks: question.marks,
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
          text: option.text,
          ...(includePrivateContent ? { isCorrect: option.isCorrect } : {}),
        })),
        subQuestions: question.subQuestions.map((subQuestion) => ({
          label: subQuestion.label,
          prompt: subQuestion.prompt,
          marks: subQuestion.marks,
          ...(includePrivateContent
            ? { expectedAnswer: subQuestion.expectedAnswer, markingGuide: subQuestion.markingGuide }
            : {}),
        })),
        ...(includePrivateContent
          ? {
              expectedAnswer: question.expectedAnswer,
              markingGuide: question.markingGuide,
              explanation: question.explanation,
              attachments: question.attachments,
            }
          : {}),
      })),
    })),
    ...(includePrivateContent ? { resourceManifest: definition.resourceManifest } : {}),
  };
}
