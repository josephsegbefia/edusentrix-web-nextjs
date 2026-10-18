import { createHash, randomUUID } from "node:crypto";
import mongoose, { Types, type ClientSession, type HydratedDocument } from "mongoose";
import { AssessmentDefinitionVersion, type IAssessmentDefinitionVersion } from "@/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion, type IAssessmentDeliveryVersion } from "@/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket, type IAssessmentPaperPacket } from "@/models/AssessmentPaperPacket";
import { AssessmentPaperPacketAssignment, type IAssessmentPaperPacketAssignment } from "@/models/AssessmentPaperPacketAssignment";
import { AssessmentPaperPacketCorrection } from "@/models/AssessmentPaperPacketCorrection";
import { AssessmentEvidencePage, type IAssessmentEvidencePage } from "@/models/AssessmentEvidencePage";
import { AssessmentEvidenceReceipt } from "@/models/AssessmentEvidenceReceipt";
import { AssessmentMarkingAssignment, type IAssessmentMarkingAssignment } from "@/models/AssessmentMarkingAssignment";
import { AssessmentMarkingEvaluation, type IAssessmentMarkingEvaluation, type IAssessmentMarkingScoreEntry } from "@/models/AssessmentMarkingEvaluation";
import { AssessmentMarkingRevision, type IAssessmentMarkingRevision } from "@/models/AssessmentMarkingRevision";
import { AssessmentMarkingReviewerAssignment, type IAssessmentMarkingReviewerAssignment } from "@/models/AssessmentMarkingReviewerAssignment";
import { AssessmentApprovedMarkingOutcome, type IAssessmentApprovedMarkingOutcome, type IAssessmentMarkingEvidenceProvenance } from "@/models/AssessmentApprovedMarkingOutcome";
import { AssessmentScoreHandoffReceipt, type IAssessmentScoreHandoffReceipt } from "@/models/AssessmentScoreHandoffReceipt";
import { StoredAsset } from "@/models/StoredAsset";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import type { AuditRequestContext } from "@/lib/audit/types";
import { getR2Port } from "@/lib/storage/r2";
import { contentDispositionValue } from "@/lib/storage/filename";
import { DEFAULT_SIGNED_URL_TTL_SECONDS, getR2Config, isR2Configured } from "@/lib/storage/config";
import { hashAssessmentDefinition } from "@/lib/assess/assessment-definition-service";
import { fenceActivePacketAssignment } from "@/lib/assess/assessment-packet-assignment-fence";

const TRANSACTION_OPTIONS = { readConcern: { level: "snapshot" as const }, writeConcern: { w: "majority" as const }, maxCommitTimeMS: 10_000 };
const ACTIVE_DELIVERY_STATUSES = new Set(["published", "active"]);

export class AssessmentMarkingError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 502 | 503;
  constructor(message: string, status: 400 | 403 | 404 | 409 | 502 | 503 = 409) { super(message); this.name = "AssessmentMarkingError"; this.status = status; }
}

export type AssessmentMarkingAdminActor = { userId: Types.ObjectId; schoolId: Types.ObjectId; isAdmin: boolean; premiumPublicationEntitled: boolean };
export type AssessmentMarkingMarkerActor = { userId: Types.ObjectId; schoolId: Types.ObjectId; teacherId: Types.ObjectId; isAdmin: boolean; premiumPublicationEntitled: boolean };
type AuditInput = { context?: AuditRequestContext; idempotencyKey: string };

function oid(value: string | Types.ObjectId | null | undefined, label: string) {
  if (!value || !Types.ObjectId.isValid(String(value))) throw new AssessmentMarkingError(`${label} is invalid`, 400);
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}
function same(left: unknown, right: unknown) { return String(left) === String(right); }
function duplicate(error: unknown) { return Boolean(error && typeof error === "object" && (error as { code?: number }).code === 11000); }
function transient(error: unknown) {
  const value = error as { errorLabels?: unknown; message?: string } | null;
  const message = String(value?.message ?? "").toLowerCase();
  return (Array.isArray(value?.errorLabels) && (value.errorLabels.includes("TransientTransactionError") || value.errorLabels.includes("UnknownTransactionCommitResult"))) || message.includes("write conflict") || message.includes("temporarily unavailable");
}
async function transaction<T>(callback: (session: ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let last: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { return await session.withTransaction(() => callback(session), TRANSACTION_OPTIONS); }
      catch (error) { last = error; if (!transient(error) || attempt === 4) throw error; }
    }
    throw last instanceof Error ? last : new Error("Marking transaction failed");
  } finally { await session.endSession(); }
}
function assertAdmin(actor: AssessmentMarkingAdminActor) {
  if (!actor.isAdmin) throw new AssessmentMarkingError("Only school administrators can manage marking assignments or review evaluations", 403);
  if (!actor.premiumPublicationEntitled) throw new AssessmentMarkingError("Premium Assess marking entitlement is required", 403);
}
function assertMarker(actor: AssessmentMarkingMarkerActor) {
  if (!actor.premiumPublicationEntitled) throw new AssessmentMarkingError("Premium Assess marking entitlement is required", 403);
  if (!actor.teacherId) throw new AssessmentMarkingError("An active teacher identity is required for marking", 403);
}
function key(value: string, label: string) {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 240) throw new AssessmentMarkingError(`A valid ${label} is required`, 400);
  return normalized;
}
function context(actor: { userId: Types.ObjectId; schoolId: Types.ObjectId }, input: AuditInput, role: string, suffix: string): AuditRequestContext {
  const c = input.context;
  return { requestId: c?.requestId || randomUUID(), correlationId: c?.correlationId || c?.requestId || randomUUID(), idempotencyKey: `${input.idempotencyKey}:${suffix}`, actorType: "user", actorId: actor.userId, actorRole: role, actorEmail: c?.actorEmail ?? null, actorName: c?.actorName ?? null, schoolId: actor.schoolId, ipAddress: c?.ipAddress ?? null, userAgent: c?.userAgent ?? null, routePath: c?.routePath ?? null, clientSurface: c?.clientSurface ?? "api" };
}

type QuestionDescriptor = {
  questionId: string;
  sectionId: string;
  sectionTitle: string;
  questionOrder: number;
  prompt: string;
  plainTextPrompt: string | null;
  marks: number;
  expectedAnswer: string | null;
  markingGuide: string | null;
  subQuestions: Array<{ label: string; prompt: string; marks: number; expectedAnswer: string | null; markingGuide: string | null }>;
  criteriaDigest: string;
};

function questionCatalog(definition: IAssessmentDefinitionVersion): QuestionDescriptor[] {
  const result: QuestionDescriptor[] = [];
  const seen = new Set<string>();
  for (const section of [...definition.sections].sort((a, b) => a.order - b.order)) {
    for (const question of [...section.questions].sort((a, b) => a.order - b.order)) {
      const questionId = String(question.sourceQuestionId);
      if (seen.has(questionId)) throw new AssessmentMarkingError("The published definition contains duplicate question identities", 409);
      seen.add(questionId);
      result.push({
        questionId,
        sectionId: String(section.sourceSectionId),
        sectionTitle: section.title,
        questionOrder: question.order,
        prompt: question.prompt,
        plainTextPrompt: question.plainTextPrompt ?? null,
        marks: question.marks,
        expectedAnswer: question.expectedAnswer ?? null,
        markingGuide: question.markingGuide ?? null,
        subQuestions: question.subQuestions.map((sub) => ({ label: sub.label, prompt: sub.prompt, marks: sub.marks, expectedAnswer: sub.expectedAnswer ?? null, markingGuide: sub.markingGuide ?? null })),
        criteriaDigest: hashAssessmentDefinition({ questionId, prompt: question.prompt, expectedAnswer: question.expectedAnswer ?? null, markingGuide: question.markingGuide ?? null, marks: question.marks, subQuestions: question.subQuestions }),
      });
    }
  }
  return result;
}

function initialScoreEntries(definition: IAssessmentDefinitionVersion): IAssessmentMarkingScoreEntry[] {
  return questionCatalog(definition).map((question) => ({ questionId: question.questionId, sectionId: question.sectionId, questionOrder: question.questionOrder, maximumMarks: question.marks, criteriaDigest: question.criteriaDigest, score: null, feedback: null }));
}

function normalizedScores(definition: IAssessmentDefinitionVersion, input: Array<{ questionId: string; score?: number | null; feedback?: string | null }> | undefined) {
  const catalog = questionCatalog(definition);
  const byId = new Map(catalog.map((question) => [question.questionId, question]));
  const incoming = input ?? [];
  if (incoming.length > catalog.length) throw new AssessmentMarkingError("The marking payload contains too many question entries", 400);
  const seen = new Set<string>();
  for (const entry of incoming) {
    if (!entry || typeof entry.questionId !== "string" || !byId.has(entry.questionId)) throw new AssessmentMarkingError("A marking entry references an unpublished question", 400);
    if (seen.has(entry.questionId)) throw new AssessmentMarkingError("A question may only have one score entry", 400);
    seen.add(entry.questionId);
    if (entry.score != null) {
      if (!Number.isFinite(entry.score) || entry.score < 0) throw new AssessmentMarkingError("Scores must be non-negative numbers", 400);
      if (entry.score > byId.get(entry.questionId)!.marks) throw new AssessmentMarkingError(`Score exceeds the maximum for question ${entry.questionId}`, 400);
      if (Math.abs(entry.score * 100 - Math.round(entry.score * 100)) > 1e-9) throw new AssessmentMarkingError("Scores may use at most two decimal places", 400);
    }
  }
  const scores = catalog.map((question) => {
    const entry = incoming.find((candidate) => candidate.questionId === question.questionId);
    return { questionId: question.questionId, sectionId: question.sectionId, questionOrder: question.questionOrder, maximumMarks: question.marks, criteriaDigest: question.criteriaDigest, score: entry?.score == null ? null : Number(entry.score), feedback: entry?.feedback?.trim() || null };
  });
  const totalMarks = scores.every((entry) => entry.score == null) ? null : scores.reduce((sum, entry) => sum + (entry.score ?? 0), 0);
  const unmarkedQuestionCount = scores.filter((entry) => entry.score == null).length;
  return { scores, totalMarks, unmarkedQuestionCount };
}

function serializedScores(scores: IAssessmentMarkingScoreEntry[]) {
  return scores.map((score) => ({ questionId: score.questionId, sectionId: score.sectionId, questionOrder: score.questionOrder, maximumMarks: score.maximumMarks, score: score.score, feedback: score.feedback }));
}

async function loadMarker(markerUserId: Types.ObjectId, schoolId: Types.ObjectId, session?: ClientSession) {
  const teacherQuery = Teacher.findOne({ userId: markerUserId, schoolId, status: "active" }).select("_id userId schoolId status");
  const membershipQuery = UserMembership.findOne({ userId: markerUserId, schoolId, status: "active", roles: "teacher" }).select("_id");
  const [teacher, membership] = await Promise.all([
    (session ? teacherQuery.session(session) : teacherQuery).lean(),
    (session ? membershipQuery.session(session) : membershipQuery).lean(),
  ]);
  if (!teacher || !membership) throw new AssessmentMarkingError("The selected marker is not an active teacher in this school", 409);
  return teacher;
}

async function loadReviewer(reviewerUserId: Types.ObjectId, schoolId: Types.ObjectId, session?: ClientSession) {
  const membershipQuery = UserMembership.findOne({ userId: reviewerUserId, schoolId, status: "active", roles: "school_admin" }).select("_id");
  const userQuery = User.findOne({ _id: reviewerUserId, schoolId }).select("_id name firstName lastName");
  const [membership, user] = await Promise.all([
    (session ? membershipQuery.session(session) : membershipQuery).lean(),
    (session ? userQuery.session(session) : userQuery).lean<{ _id: Types.ObjectId; name?: string; firstName?: string; lastName?: string } | null>(),
  ]);
  if (!membership || !user) throw new AssessmentMarkingError("The selected reviewer is not an active school administrator", 409);
  return { user, name: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || null };
}

async function sourceForAssignment(input: { schoolId: Types.ObjectId; markingAssignment?: IAssessmentMarkingAssignment | null; packetAssignmentId?: Types.ObjectId; session?: ClientSession }) {
  const packetAssignmentId = input.packetAssignmentId ?? input.markingAssignment?.packetAssignmentId;
  if (!packetAssignmentId) throw new AssessmentMarkingError("Marking assignment source is missing", 409);
  const assignmentQuery = AssessmentPaperPacketAssignment.findOne({ _id: packetAssignmentId, schoolId: input.schoolId, status: "active" });
  const packetAssignment = await (input.session ? assignmentQuery.session(input.session) : assignmentQuery).lean<IAssessmentPaperPacketAssignment | null>();
  if (!packetAssignment) return { eligible: false as const, reason: "The candidate packet assignment is no longer active", packetAssignment: null, pages: [] };
  const deliveryQuery = AssessmentDeliveryVersion.findOne({ _id: packetAssignment.assessmentDeliveryVersionId, schoolId: input.schoolId });
  const delivery = await (input.session ? deliveryQuery.session(input.session) : deliveryQuery).lean<IAssessmentDeliveryVersion | null>();
  if (!delivery || delivery.mode !== "paper" || !ACTIVE_DELIVERY_STATUSES.has(delivery.status)) return { eligible: false as const, reason: "The assessment delivery is not active", packetAssignment, pages: [] };
  const definitionQuery = AssessmentDefinitionVersion.findOne({ _id: delivery.assessmentDefinitionVersionId, schoolId: input.schoolId, status: "published" });
  const definition = await (input.session ? definitionQuery.session(input.session) : definitionQuery).lean<IAssessmentDefinitionVersion | null>();
  if (!definition || definition.contentHash !== delivery.definitionContentHash) return { eligible: false as const, reason: "The published assessment definition does not match the delivery", packetAssignment, pages: [] };
  const packetQuery = AssessmentPaperPacket.findOne({ _id: packetAssignment.assessmentPaperPacketId, schoolId: input.schoolId, assessmentDeliveryVersionId: delivery._id, status: "issued" });
  const packet = await (input.session ? packetQuery.session(input.session) : packetQuery).lean<IAssessmentPaperPacket | null>();
  if (!packet) return { eligible: false as const, reason: "The issued paper packet is unavailable", packetAssignment, pages: [] };
  const correctionPendingQuery = AssessmentPaperPacketCorrection.findOne({ schoolId: input.schoolId, assignmentId: packetAssignment._id, status: "pending" }).select("_id").lean();
  const correctionPending = await (input.session ? correctionPendingQuery.session(input.session) : correctionPendingQuery);
  if (correctionPending) return { eligible: false as const, reason: "Candidate identity correction is pending", packetAssignment, pages: [] };
  const pageQuery = AssessmentEvidencePage.find({ schoolId: input.schoolId, assessmentDeliveryVersionId: delivery._id, packetId: packet._id, assignmentId: packetAssignment._id, accepted: true, status: "verified", integrityStatus: "verified" });
  const pages = await (input.session ? pageQuery.session(input.session) : pageQuery).lean<IAssessmentEvidencePage[]>();
  const receiptsQuery = AssessmentEvidenceReceipt.find({ schoolId: input.schoolId, evidencePageId: { $in: pages.map((page) => page._id) }, status: "confirmed" });
  const receipts = await (input.session ? receiptsQuery.session(input.session) : receiptsQuery).lean();
  const receiptIds = new Set(receipts.map((receipt) => String(receipt.evidencePageId)));
  const assetIds = pages.filter((page) => receiptIds.has(String(page._id)) && page.assetId).map((page) => page.assetId);
  const assetsQuery = StoredAsset.find({ _id: { $in: assetIds }, schoolId: input.schoolId, kind: "assess_script_page", visibility: "private", status: "ready", "association.type": "assessmentEvidencePage", "association.id": { $in: pages.map((page) => page._id) } });
  const assets = await (input.session ? assetsQuery.session(input.session) : assetsQuery).lean();
  const assetIdsReady = new Set(assets.map((asset) => String(asset._id)));
  const receiptByPageId = new Map(receipts.map((receipt) => [String(receipt.evidencePageId), receipt]));
  const assetById = new Map(assets.map((asset) => [String(asset._id), asset]));
  const pageById = new Map(pages.map((page) => [page.pageId, page]));
  const missing = packet.pageManifest.filter((manifest) => {
    const page = pageById.get(manifest.pageId);
    return !page || !receiptIds.has(String(page._id)) || !page.assetId || !assetIdsReady.has(String(page.assetId));
  });
  if (missing.length) return { eligible: false as const, reason: `Required verified evidence is missing for ${missing.length} page${missing.length === 1 ? "" : "s"}`, packetAssignment, delivery, definition, packet, pages, missing };
  const integrityMismatch = packet.pageManifest.filter((manifest) => {
    const page = pageById.get(manifest.pageId);
    const receipt = page ? receiptByPageId.get(String(page._id)) : null;
    const asset = page?.assetId ? assetById.get(String(page.assetId)) : null;
    return !page || !receipt || !asset || page.verifiedDigest !== receipt.digest || asset.sizeBytes !== receipt.sizeBytes || String(asset.association?.id) !== String(page._id);
  });
  if (integrityMismatch.length) return { eligible: false as const, reason: `Evidence integrity provenance is inconsistent for ${integrityMismatch.length} page${integrityMismatch.length === 1 ? "" : "s"}`, packetAssignment, delivery, definition, packet, pages, missing: integrityMismatch.map((entry) => ({ pageId: entry.pageId, pageNumber: entry.pageNumber })) };
  const evidenceProvenance: IAssessmentMarkingEvidenceProvenance[] = packet.pageManifest.map((manifest) => {
    const page = pageById.get(manifest.pageId);
    const receipt = page ? receiptByPageId.get(String(page._id)) : null;
    const asset = page?.assetId ? assetById.get(String(page.assetId)) : null;
    if (!page || !receipt || !asset || !page.assetId || !receipt.digest || !receipt.sizeBytes) throw new AssessmentMarkingError("Verified evidence provenance is incomplete", 409);
    return { evidencePageId: page._id, pageId: page.pageId, pageNumber: page.expectedPageNumber, assetId: page.assetId, receiptId: receipt._id, digest: receipt.digest, sizeBytes: receipt.sizeBytes };
  });
  return { eligible: true as const, reason: null, packetAssignment, delivery, definition, packet, pages, evidenceProvenance, missing: [] as Array<{ pageId: string; pageNumber: number }> };
}

function serializeAssignment(row: IAssessmentMarkingAssignment, input: { candidate?: { firstName: string; middleName?: string | null; lastName: string; admissionNo?: string | null } | null; includeCandidate: boolean; markerName?: string | null }) {
  return { id: String(row._id), schoolId: String(row.schoolId), assessmentDefinitionVersionId: String(row.assessmentDefinitionVersionId), deliveryId: String(row.assessmentDeliveryVersionId), packetId: String(row.assessmentPaperPacketId), packetAssignmentId: String(row.packetAssignmentId), studentId: input.includeCandidate ? String(row.studentId) : null, candidate: input.includeCandidate && input.candidate ? { firstName: input.candidate.firstName, middleName: input.candidate.middleName ?? null, lastName: input.candidate.lastName, admissionNo: input.candidate.admissionNo ?? null } : null, markerUserId: String(row.markerUserId), markerName: input.markerName ?? null, status: row.status, blindMarking: row.blindMarking, assignedAt: row.assignedAt, reassignedAt: row.reassignedAt, reassignReason: row.reassignReason };
}

function serializeDefinition(definition: IAssessmentDefinitionVersion) {
  return { id: String(definition._id), title: definition.title, version: definition.version, contentHash: definition.contentHash, durationMinutes: definition.durationMinutes ?? null, resultBinding: definition.resultBinding, maximumMarks: definition.scoring.maximumMarks, sections: definition.sections.map((section) => ({ id: String(section.sourceSectionId), title: section.title, instructions: section.instructions, order: section.order, questions: section.questions.map((question) => ({ id: String(question.sourceQuestionId), order: question.order, type: question.type, prompt: question.prompt, plainTextPrompt: question.plainTextPrompt, marks: question.marks, expectedAnswer: question.expectedAnswer, markingGuide: question.markingGuide, subQuestions: question.subQuestions })) })) };
}

async function candidateFor(schoolId: Types.ObjectId, studentId: Types.ObjectId, session?: ClientSession) {
  const query = Student.findOne({ _id: studentId, schoolId }).select("firstName middleName lastName admissionNo");
  return (session ? query.session(session) : query).lean<{ firstName: string; middleName?: string | null; lastName: string; admissionNo?: string | null } | null>();
}
async function markerNameFor(schoolId: Types.ObjectId, userId: Types.ObjectId, session?: ClientSession) {
  const query = User.findOne({ _id: userId, schoolId }).select("name firstName lastName");
  const user = await (session ? query.session(session) : query).lean<{ name?: string; firstName?: string; lastName?: string } | null>();
  return user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
}

function serializeReviewerAssignment(row: IAssessmentMarkingReviewerAssignment, reviewerName: string | null = null) {
  return { id: String(row._id), markingAssignmentId: String(row.markingAssignmentId), markingEvaluationId: row.markingEvaluationId ? String(row.markingEvaluationId) : null, reviewerUserId: String(row.reviewerUserId), reviewerName, status: row.status, assignedAt: row.assignedAt, revokedAt: row.revokedAt, revokeReason: row.revokeReason, completedAt: row.completedAt };
}

function serializeApprovedOutcome(outcome: IAssessmentApprovedMarkingOutcome) {
  return {
    id: String(outcome._id),
    status: outcome.status,
    schoolId: String(outcome.schoolId),
    definitionId: String(outcome.assessmentDefinitionVersionId),
    deliveryId: String(outcome.assessmentDeliveryVersionId),
    packetId: String(outcome.assessmentPaperPacketId),
    packetAssignmentId: String(outcome.packetAssignmentId),
    studentId: String(outcome.studentId),
    markingAssignmentId: String(outcome.markingAssignmentId),
    markingEvaluationId: String(outcome.markingEvaluationId),
    reviewerAssignmentId: String(outcome.reviewerAssignmentId),
    approvedRevisionId: String(outcome.approvedRevisionId),
    approvedRevisionNumber: outcome.approvedRevisionNumber,
    questionScores: serializedScores(outcome.questionScores),
    totalMarks: outcome.totalMarks,
    maximumAvailableMarks: outcome.maximumAvailableMarks,
    unmarkedQuestionCount: outcome.unmarkedQuestionCount,
    definitionContentHash: outcome.definitionContentHash,
    deliveryContentHash: outcome.deliveryContentHash,
    questionCatalogDigest: outcome.questionCatalogDigest,
    evidenceProvenance: outcome.evidenceProvenance.map((entry) => ({ evidencePageId: String(entry.evidencePageId), pageId: entry.pageId, pageNumber: entry.pageNumber, assetId: String(entry.assetId), receiptId: String(entry.receiptId), digest: entry.digest, sizeBytes: entry.sizeBytes })),
    evidenceProvenanceDigest: outcome.evidenceProvenanceDigest,
    integrityReference: outcome.integrityReference,
    approvedBy: String(outcome.approvedBy),
    approvedAt: outcome.approvedAt,
    coreResultStatus: outcome.coreResultStatus,
    scoreHandoffStatus: outcome.scoreHandoffStatus,
  };
}

async function reviewerCandidates(schoolId: Types.ObjectId) {
  const memberships = await UserMembership.find({ schoolId, status: "active", roles: "school_admin" }).select("userId").lean<Array<{ userId: Types.ObjectId }>>();
  const users = await User.find({ _id: { $in: memberships.map((membership) => membership.userId) }, schoolId }).select("_id name firstName lastName").lean<Array<{ _id: Types.ObjectId; name?: string; firstName?: string; lastName?: string }>>();
  return users.map((user) => ({ userId: String(user._id), name: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || `Administrator ${String(user._id).slice(-6)}` }));
}

export async function listMarkingAdminQueue(input: { actor: AssessmentMarkingAdminActor; assessmentDeliveryVersionId: Types.ObjectId }) {
  assertAdmin(input.actor);
  const deliveryId = oid(input.assessmentDeliveryVersionId, "Assessment delivery id");
  const packetAssignments = await AssessmentPaperPacketAssignment.find({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: deliveryId, status: "active" }).sort({ assignedAt: -1 }).lean<IAssessmentPaperPacketAssignment[]>();
  const existing = await AssessmentMarkingAssignment.find({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: deliveryId }).sort({ updatedAt: -1 }).lean<IAssessmentMarkingAssignment[]>();
  const existingByPacketAssignment = new Map(existing.filter((row) => row.status === "active").map((row) => [String(row.packetAssignmentId), row]));
  const eligibleScripts: Array<Record<string, unknown>> = [];
  for (const packetAssignment of packetAssignments) {
    const source = await sourceForAssignment({ schoolId: input.actor.schoolId, packetAssignmentId: packetAssignment._id });
    if (source.eligible && !existingByPacketAssignment.has(String(packetAssignment._id))) {
      const candidate = await candidateFor(input.actor.schoolId, packetAssignment.studentId);
      eligibleScripts.push({ packetAssignmentId: String(packetAssignment._id), packetId: String(packetAssignment.assessmentPaperPacketId), deliveryId: String(packetAssignment.assessmentDeliveryVersionId), pageCount: source.pages.length, studentId: String(packetAssignment.studentId), candidate: candidate ? { firstName: candidate.firstName, middleName: candidate.middleName ?? null, lastName: candidate.lastName, admissionNo: candidate.admissionNo ?? null } : null });
    }
  }
  const markerRows = await Teacher.find({ schoolId: input.actor.schoolId, status: "active" }).select("_id userId").lean<Array<{ _id: Types.ObjectId; userId: Types.ObjectId }>>();
  const markerUsers = await User.find({ _id: { $in: markerRows.map((row) => row.userId) }, schoolId: input.actor.schoolId }).select("_id name firstName lastName").lean<Array<{ _id: Types.ObjectId; name?: string; firstName?: string; lastName?: string }>>();
  const markerUserMap = new Map(markerUsers.map((user) => [String(user._id), user]));
  const markers = markerRows.map((row) => { const user = markerUserMap.get(String(row.userId)); return { teacherId: String(row._id), userId: String(row.userId), name: user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || `Teacher ${String(row.userId).slice(-6)}` }; });
  const reviews = await AssessmentMarkingEvaluation.find({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: deliveryId, status: "submitted" }).sort({ submittedAt: 1 }).lean<IAssessmentMarkingEvaluation[]>();
  const reviewQueue = await Promise.all(reviews.map(async (evaluation) => {
    const assignment = existing.find((row) => same(row._id, evaluation.markingAssignmentId));
    const candidate = await candidateFor(input.actor.schoolId, evaluation.studentId);
    const reviewer = await AssessmentMarkingReviewerAssignment.findOne({ schoolId: input.actor.schoolId, markingAssignmentId: evaluation.markingAssignmentId }).sort({ updatedAt: -1 }).lean<IAssessmentMarkingReviewerAssignment | null>();
    const reviewerName = reviewer ? await markerNameFor(input.actor.schoolId, reviewer.reviewerUserId) : null;
    return { evaluationId: String(evaluation._id), assignmentId: String(evaluation.markingAssignmentId), status: evaluation.status, totalMarks: evaluation.totalMarks, maximumMarks: evaluation.questionScores.reduce((sum, entry) => sum + entry.maximumMarks, 0), submittedAt: evaluation.submittedAt, candidate: candidate ? { firstName: candidate.firstName, middleName: candidate.middleName ?? null, lastName: candidate.lastName, admissionNo: candidate.admissionNo ?? null } : null, blindMarking: assignment?.blindMarking ?? evaluation.blindMarking, reviewer: reviewer ? serializeReviewerAssignment(reviewer, reviewerName) : null };
  }));
  const approvedEvaluations = await AssessmentMarkingEvaluation.find({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: deliveryId, status: "approved" }).sort({ approvedAt: -1 }).lean<IAssessmentMarkingEvaluation[]>();
  const approvedResults = await Promise.all(approvedEvaluations.map(async (evaluation) => {
    const assignment = existing.find((row) => same(row._id, evaluation.markingAssignmentId));
    const outcome = await AssessmentApprovedMarkingOutcome.findOne({ schoolId: input.actor.schoolId, markingEvaluationId: evaluation._id, status: "current" }).lean<IAssessmentApprovedMarkingOutcome | null>();
    if (!outcome) return null;
    const receipt = await AssessmentScoreHandoffReceipt.findOne({ schoolId: input.actor.schoolId, sourceOutcomeId: outcome._id, status: "completed" }).lean<IAssessmentScoreHandoffReceipt | null>();
    const candidate = await candidateFor(input.actor.schoolId, evaluation.studentId);
    return { evaluationId: String(evaluation._id), outcomeId: String(outcome._id), assignmentId: String(evaluation.markingAssignmentId), totalMarks: outcome.totalMarks, maximumMarks: outcome.maximumAvailableMarks, approvedAt: outcome.approvedAt, candidate: candidate ? { firstName: candidate.firstName, middleName: candidate.middleName ?? null, lastName: candidate.lastName, admissionNo: candidate.admissionNo ?? null } : null, blindMarking: assignment?.blindMarking ?? evaluation.blindMarking, handoff: receipt ? { status: receipt.status, receiptId: String(receipt._id), coreAssessmentScoreId: receipt.coreAssessmentScoreId ? String(receipt.coreAssessmentScoreId) : null } : null };
  }));
  const assignments = await Promise.all(existing.map(async (row) => serializeAssignment(row, { includeCandidate: true, candidate: await candidateFor(input.actor.schoolId, row.studentId), markerName: await markerNameFor(input.actor.schoolId, row.markerUserId) })));
  return { eligibleScripts, markers, reviewers: await reviewerCandidates(input.actor.schoolId), assignments, reviewQueue, approvedResults: approvedResults.filter(Boolean) };
}

export async function assignMarkingReviewer(input: { actor: AssessmentMarkingAdminActor; markingAssignmentId: Types.ObjectId; reviewerUserId: Types.ObjectId; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertAdmin(input.actor);
  const markingAssignmentId = oid(input.markingAssignmentId, "Marking assignment id");
  const reviewerUserId = oid(input.reviewerUserId, "Reviewer user id");
  const idempotencyKey = key(input.idempotencyKey, "reviewer assignment idempotency key");
  try {
    return await transaction(async (session) => {
      const replay = await AssessmentMarkingReviewerAssignment.findOne({ schoolId: input.actor.schoolId, idempotencyKey }).session(session).lean<IAssessmentMarkingReviewerAssignment | null>();
      if (replay) {
        if (!same(replay.markingAssignmentId, markingAssignmentId) || !same(replay.reviewerUserId, reviewerUserId)) throw new AssessmentMarkingError("The reviewer idempotency key is already bound to another assignment", 409);
        return { reviewerAssignment: serializeReviewerAssignment(replay, await markerNameFor(input.actor.schoolId, replay.reviewerUserId, session)), replayed: true };
      }
      const assignment = await AssessmentMarkingAssignment.findOne({ _id: markingAssignmentId, schoolId: input.actor.schoolId, status: "active" }).session(session).lean<IAssessmentMarkingAssignment | null>();
      if (!assignment) throw new AssessmentMarkingError("Active marking assignment not found", 404);
      if (same(assignment.markerUserId, reviewerUserId)) throw new AssessmentMarkingError("The submitting marker cannot be assigned as reviewer", 403);
      const source = await sourceForAssignment({ schoolId: input.actor.schoolId, markingAssignment: assignment, session });
      if (!source.eligible || !source.delivery || !source.definition || !source.packetAssignment || !source.packet) throw new AssessmentMarkingError(source.reason ?? "The script is not eligible for review", 409);
      await loadReviewer(reviewerUserId, input.actor.schoolId, session);
      const active = await AssessmentMarkingReviewerAssignment.findOne({ schoolId: input.actor.schoolId, markingAssignmentId, status: "active" }).session(session).lean<IAssessmentMarkingReviewerAssignment | null>();
      if (active) throw new AssessmentMarkingError("This script already has an active reviewer assignment", 409);
      const evaluation = await AssessmentMarkingEvaluation.findOne({ schoolId: input.actor.schoolId, markingAssignmentId }).session(session).select("_id status").lean<{ _id: Types.ObjectId; status: string } | null>();
      const reviewerAssignment = new AssessmentMarkingReviewerAssignment({ schoolId: input.actor.schoolId, assessmentDefinitionVersionId: assignment.assessmentDefinitionVersionId, assessmentDeliveryVersionId: assignment.assessmentDeliveryVersionId, assessmentPaperPacketId: assignment.assessmentPaperPacketId, packetAssignmentId: assignment.packetAssignmentId, markingAssignmentId, markingEvaluationId: evaluation?._id ?? null, reviewerUserId, assignedBy: input.actor.userId, assignedAt: new Date(), status: "active", idempotencyKey, revokedAt: null, revokedBy: null, revokeReason: null, completedAt: null });
      await reviewerAssignment.save({ session });
      await writeTransactionalAuditEvent(session, { actionCode: "assessment.marking.reviewer_assigned", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentMarkingReviewerAssignment", targetEntityId: reviewerAssignment._id, secondaryEntityType: "AssessmentMarkingAssignment", secondaryEntityId: markingAssignmentId }, context: context(input.actor, { context: input.auditContext, idempotencyKey }, "school_admin", `reviewer-assigned:${reviewerAssignment._id}`), payload: { before: { reviewerAssignmentId: null, status: null }, after: { reviewerAssignmentId: String(reviewerAssignment._id), reviewerUserId: String(reviewerUserId), markingAssignmentId: String(markingAssignmentId), status: "active" }, changedFields: ["reviewerUserId", "status"], metadata: { assessmentDefinitionVersionId: String(assignment.assessmentDefinitionVersionId), assessmentDeliveryVersionId: String(assignment.assessmentDeliveryVersionId), assessmentPaperPacketId: String(assignment.assessmentPaperPacketId), packetAssignmentId: String(assignment.packetAssignmentId), markingAssignmentId: String(markingAssignmentId), markingEvaluationId: evaluation?._id ? String(evaluation._id) : null, previousStatus: null, resultingStatus: "active" } }, streamKey: `school:${String(input.actor.schoolId)}` });
      return { reviewerAssignment: serializeReviewerAssignment(reviewerAssignment.toObject() as IAssessmentMarkingReviewerAssignment, await markerNameFor(input.actor.schoolId, reviewerUserId, session)), replayed: false };
    });
  } catch (error) { if (duplicate(error)) throw new AssessmentMarkingError("Concurrent reviewer assignment conflicted with another active reviewer", 409); throw error; }
}

export async function revokeMarkingReviewer(input: { actor: AssessmentMarkingAdminActor; reviewerAssignmentId: Types.ObjectId; reason: string; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertAdmin(input.actor);
  const reviewerAssignmentId = oid(input.reviewerAssignmentId, "Reviewer assignment id");
  const reason = input.reason.trim();
  const idempotencyKey = key(input.idempotencyKey, "reviewer revocation idempotency key");
  if (reason.length < 3 || reason.length > 2000) throw new AssessmentMarkingError("A reviewer revocation reason is required", 400);
  return transaction(async (session) => {
    const current = await AssessmentMarkingReviewerAssignment.findOne({ _id: reviewerAssignmentId, schoolId: input.actor.schoolId }).session(session);
    if (!current) throw new AssessmentMarkingError("Reviewer assignment not found", 404);
    if (current.status === "revoked") return { reviewerAssignment: serializeReviewerAssignment(current.toObject() as IAssessmentMarkingReviewerAssignment), replayed: true };
    if (current.status !== "active") throw new AssessmentMarkingError("A completed reviewer assignment cannot be revoked", 409);
    current.status = "revoked"; current.revokedAt = new Date(); current.revokedBy = input.actor.userId; current.revokeReason = reason; await current.save({ session });
    await writeTransactionalAuditEvent(session, { actionCode: "assessment.marking.reviewer_revoked", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentMarkingReviewerAssignment", targetEntityId: current._id, secondaryEntityType: "AssessmentMarkingAssignment", secondaryEntityId: current.markingAssignmentId }, context: context(input.actor, { context: input.auditContext, idempotencyKey }, "school_admin", `reviewer-revoked:${current._id}`), reason: { reasonCode: "reviewer_assignment_revoked", reason }, payload: { before: { status: "active", reviewerUserId: String(current.reviewerUserId) }, after: { status: "revoked", reviewerUserId: String(current.reviewerUserId), revokedBy: String(input.actor.userId) }, changedFields: ["status", "revokedAt", "revokedBy", "revokeReason"], metadata: { assessmentDefinitionVersionId: String(current.assessmentDefinitionVersionId), assessmentDeliveryVersionId: String(current.assessmentDeliveryVersionId), assessmentPaperPacketId: String(current.assessmentPaperPacketId), packetAssignmentId: String(current.packetAssignmentId), markingAssignmentId: String(current.markingAssignmentId), markingEvaluationId: current.markingEvaluationId ? String(current.markingEvaluationId) : null, previousStatus: "active", resultingStatus: "revoked" } }, streamKey: `school:${String(input.actor.schoolId)}` });
    return { reviewerAssignment: serializeReviewerAssignment(current.toObject() as IAssessmentMarkingReviewerAssignment), replayed: false };
  });
}

export async function assignMarkingScript(input: { actor: AssessmentMarkingAdminActor; packetAssignmentId: Types.ObjectId; markerUserId: Types.ObjectId; blindMarking?: boolean; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertAdmin(input.actor);
  const packetAssignmentId = oid(input.packetAssignmentId, "Packet assignment id");
  const markerUserId = oid(input.markerUserId, "Marker user id");
  const idempotencyKey = key(input.idempotencyKey, "marking assignment idempotency key");
  try {
    return await transaction(async (session) => {
      const replay = await AssessmentMarkingAssignment.findOne({ schoolId: input.actor.schoolId, idempotencyKey }).session(session).lean<IAssessmentMarkingAssignment | null>();
      if (replay) {
        if (!same(replay.packetAssignmentId, packetAssignmentId) || !same(replay.markerUserId, markerUserId)) throw new AssessmentMarkingError("The idempotency key is already bound to another marking assignment", 409);
        return { assignment: serializeAssignment(replay, { includeCandidate: false }), replayed: true };
      }
      const source = await sourceForAssignment({ schoolId: input.actor.schoolId, packetAssignmentId, session });
      if (!source.eligible || !source.delivery || !source.definition || !source.packetAssignment || !source.packet) throw new AssessmentMarkingError(source.reason ?? "The script is not eligible for marking", 409);
      const teacher = await loadMarker(markerUserId, input.actor.schoolId, session);
      const existing = await AssessmentMarkingAssignment.findOne({ schoolId: input.actor.schoolId, packetAssignmentId, status: "active" }).session(session).lean();
      if (existing) throw new AssessmentMarkingError("This script already has an active marker assignment", 409);
      const assignment = new AssessmentMarkingAssignment({ schoolId: input.actor.schoolId, assessmentDefinitionVersionId: source.definition._id, assessmentDeliveryVersionId: source.delivery._id, assessmentPaperPacketId: source.packet._id, packetAssignmentId: source.packetAssignment._id, studentId: source.packetAssignment.studentId, markerUserId, markerTeacherId: teacher._id, assignedBy: input.actor.userId, assignedAt: new Date(), status: "active", blindMarking: Boolean(input.blindMarking), idempotencyKey, reassignedAt: null, reassignedBy: null, reassignReason: null, closedAt: null });
      await assignment.save({ session });
      await writeTransactionalAuditEvent(session, { actionCode: "assessment.marking.assignment_assigned", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentMarkingAssignment", targetEntityId: assignment._id, secondaryEntityType: "AssessmentPaperPacketAssignment", secondaryEntityId: source.packetAssignment._id }, context: context(input.actor, { context: input.auditContext, idempotencyKey }, "school_admin", `assigned:${assignment._id}`), payload: { metadata: { assessmentDeliveryVersionId: String(source.delivery._id), assessmentDefinitionVersionId: String(source.definition._id), packetAssignmentId: String(source.packetAssignment._id), markerUserId: String(markerUserId), blindMarking: assignment.blindMarking } }, streamKey: `school:${String(input.actor.schoolId)}` });
      return { assignment: serializeAssignment(assignment.toObject() as IAssessmentMarkingAssignment, { includeCandidate: true, candidate: await candidateFor(input.actor.schoolId, assignment.studentId, session), markerName: await markerNameFor(input.actor.schoolId, markerUserId, session) }), replayed: false };
    });
  } catch (error) { if (duplicate(error)) throw new AssessmentMarkingError("Concurrent marking assignment conflicted with another active marker", 409); throw error; }
}

export async function reassignMarkingScript(input: { actor: AssessmentMarkingAdminActor; markingAssignmentId: Types.ObjectId; markerUserId: Types.ObjectId; blindMarking?: boolean; reason: string; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertAdmin(input.actor);
  const markingAssignmentId = oid(input.markingAssignmentId, "Marking assignment id");
  const markerUserId = oid(input.markerUserId, "Marker user id");
  const reason = input.reason.trim();
  const idempotencyKey = key(input.idempotencyKey, "marking reassignment idempotency key");
  if (reason.length < 3 || reason.length > 2000) throw new AssessmentMarkingError("A reassignment reason is required", 400);
  try {
    return await transaction(async (session) => {
      const current = await AssessmentMarkingAssignment.findOne({ _id: markingAssignmentId, schoolId: input.actor.schoolId, status: "active" }).session(session);
      if (!current) throw new AssessmentMarkingError("Active marking assignment not found", 404);
      if (same(current.markerUserId, markerUserId)) throw new AssessmentMarkingError("Select a different marker for reassignment", 409);
      const existingRevision = await AssessmentMarkingRevision.findOne({ schoolId: input.actor.schoolId, markingAssignmentId: current._id }).session(session).lean();
      if (existingRevision) throw new AssessmentMarkingError("Submitted marking cannot be reassigned; review or return the evaluation first", 409);
      const source = await sourceForAssignment({ schoolId: input.actor.schoolId, packetAssignmentId: current.packetAssignmentId, session });
      if (!source.eligible || !source.delivery || !source.definition || !source.packetAssignment || !source.packet) throw new AssessmentMarkingError(source.reason ?? "The script is no longer eligible for marking", 409);
      const teacher = await loadMarker(markerUserId, input.actor.schoolId, session);
      const duplicateKey = await AssessmentMarkingAssignment.findOne({ schoolId: input.actor.schoolId, idempotencyKey: `reassign:${idempotencyKey}` }).session(session).lean();
      if (duplicateKey) return { assignment: serializeAssignment(duplicateKey as IAssessmentMarkingAssignment, { includeCandidate: true, candidate: await candidateFor(input.actor.schoolId, duplicateKey.studentId, session) }), replayed: true };
      current.status = "reassigned"; current.reassignedAt = new Date(); current.reassignedBy = input.actor.userId; current.reassignReason = reason; await current.save({ session });
      const replacement = new AssessmentMarkingAssignment({ schoolId: input.actor.schoolId, assessmentDefinitionVersionId: source.definition._id, assessmentDeliveryVersionId: source.delivery._id, assessmentPaperPacketId: source.packet._id, packetAssignmentId: source.packetAssignment._id, studentId: source.packetAssignment.studentId, markerUserId, markerTeacherId: teacher._id, assignedBy: input.actor.userId, assignedAt: new Date(), status: "active", blindMarking: input.blindMarking ?? current.blindMarking, idempotencyKey: `reassign:${idempotencyKey}`, reassignedAt: null, reassignedBy: null, reassignReason: null, closedAt: null });
      await replacement.save({ session });
      await writeTransactionalAuditEvent(session, { actionCode: "assessment.marking.assignment_reassigned", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentMarkingAssignment", targetEntityId: replacement._id, secondaryEntityType: "AssessmentMarkingAssignment", secondaryEntityId: current._id }, context: context(input.actor, { context: input.auditContext, idempotencyKey }, "school_admin", `reassigned:${replacement._id}`), reason: { reasonCode: "marker_reassignment", reason }, payload: { before: { assignmentId: String(current._id), markerUserId: String(current.markerUserId), status: "active" }, after: { assignmentId: String(replacement._id), markerUserId: String(markerUserId), status: "active" }, changedFields: ["status", "markerUserId", "reassignReason"] }, streamKey: `school:${String(input.actor.schoolId)}` });
      return { assignment: serializeAssignment(replacement.toObject() as IAssessmentMarkingAssignment, { includeCandidate: true, candidate: await candidateFor(input.actor.schoolId, replacement.studentId, session) }), replayed: false };
    });
  } catch (error) { if (duplicate(error)) throw new AssessmentMarkingError("Concurrent reassignment conflicted with another active marker", 409); throw error; }
}

async function loadAssignmentForMarker(actor: AssessmentMarkingMarkerActor, assignmentId: Types.ObjectId) {
  const row = await AssessmentMarkingAssignment.findOne({ _id: oid(assignmentId, "Marking assignment id"), schoolId: actor.schoolId, markerUserId: actor.userId, status: "active" }).lean<IAssessmentMarkingAssignment | null>();
  if (!row) throw new AssessmentMarkingError("Marking assignment not found", 404);
  return row;
}
async function loadAssignmentForAdmin(actor: AssessmentMarkingAdminActor, assignmentId: Types.ObjectId) {
  const row = await AssessmentMarkingAssignment.findOne({ _id: oid(assignmentId, "Marking assignment id"), schoolId: actor.schoolId }).lean<IAssessmentMarkingAssignment | null>();
  if (!row) throw new AssessmentMarkingError("Marking assignment not found", 404);
  return row;
}

async function detailFor(input: { actor: AssessmentMarkingMarkerActor | AssessmentMarkingAdminActor; assignment: IAssessmentMarkingAssignment; includeCandidate: boolean }) {
  const source = await sourceForAssignment({ schoolId: input.actor.schoolId, markingAssignment: input.assignment });
  if (!source.delivery || !source.definition || !source.packetAssignment || !source.packet) throw new AssessmentMarkingError(source.reason ?? "The script is not available for marking", 409);
  const evaluation = await AssessmentMarkingEvaluation.findOne({ schoolId: input.actor.schoolId, markingAssignmentId: input.assignment._id }).lean<IAssessmentMarkingEvaluation | null>();
  const revisions = input.includeCandidate ? await AssessmentMarkingRevision.find({ schoolId: input.actor.schoolId, markingAssignmentId: input.assignment._id }).sort({ revisionNumber: 1 }).lean<IAssessmentMarkingRevision[]>() : [];
  const candidate = input.includeCandidate ? await candidateFor(input.actor.schoolId, input.assignment.studentId) : null;
  const serialized = serializeAssignment(input.assignment, { includeCandidate: input.includeCandidate && !input.assignment.blindMarking || input.includeCandidate, candidate, markerName: await markerNameFor(input.actor.schoolId, input.assignment.markerUserId) });
  const catalog = questionCatalog(source.definition);
  return { assignment: serialized, eligibility: { eligible: source.eligible, reason: source.reason, pages: source.pages.map((page) => ({ id: String(page._id), pageId: page.pageId, pageNumber: page.expectedPageNumber, status: page.status, integrityStatus: page.integrityStatus })) }, definition: serializeDefinition(source.definition), questions: catalog.map((question) => ({ id: question.questionId, sectionId: question.sectionId, sectionTitle: question.sectionTitle, order: question.questionOrder, prompt: question.prompt, plainTextPrompt: question.plainTextPrompt, maximumMarks: question.marks, expectedAnswer: question.expectedAnswer, markingGuide: question.markingGuide, subQuestions: question.subQuestions, criteriaDigest: question.criteriaDigest })), evaluation: evaluation ? { id: String(evaluation._id), status: evaluation.status, draftVersion: evaluation.draftVersion, questionScores: serializedScores(evaluation.questionScores), totalMarks: evaluation.totalMarks, unmarkedQuestionCount: evaluation.unmarkedQuestionCount, submittedRevision: evaluation.submittedRevision, submittedAt: evaluation.submittedAt, returnedAt: evaluation.returnedAt, returnReason: evaluation.returnReason, reviewedBy: evaluation.reviewedBy ? String(evaluation.reviewedBy) : null, reviewedAt: evaluation.reviewedAt, reviewDecision: evaluation.reviewDecision, approvedAt: evaluation.approvedAt } : { id: null, status: "assigned" as const, draftVersion: 0, questionScores: serializedScores(initialScoreEntries(source.definition)), totalMarks: null, unmarkedQuestionCount: catalog.length, submittedRevision: null, submittedAt: null, returnedAt: null, returnReason: null, reviewedBy: null, reviewedAt: null, reviewDecision: null, approvedAt: null }, history: revisions.map((revision) => ({ id: String(revision._id), revisionNumber: revision.revisionNumber, kind: revision.kind, totalMarks: revision.totalMarks, unmarkedQuestionCount: revision.unmarkedQuestionCount, actorUserId: String(revision.actorUserId), reason: revision.reason, createdAt: revision.createdAt })) };
}

export async function listMarkerAssignments(input: { actor: AssessmentMarkingMarkerActor }) {
  assertMarker(input.actor);
  const rows = await AssessmentMarkingAssignment.find({ schoolId: input.actor.schoolId, markerUserId: input.actor.userId, status: "active" }).sort({ updatedAt: -1 }).lean<IAssessmentMarkingAssignment[]>();
  return Promise.all(rows.map(async (row) => {
    const source = await sourceForAssignment({ schoolId: input.actor.schoolId, markingAssignment: row });
    const evaluation = await AssessmentMarkingEvaluation.findOne({ schoolId: input.actor.schoolId, markingAssignmentId: row._id }).select("status draftVersion totalMarks unmarkedQuestionCount submittedAt").lean<Pick<IAssessmentMarkingEvaluation, "status" | "draftVersion" | "totalMarks" | "unmarkedQuestionCount" | "submittedAt"> | null>();
    const candidate = row.blindMarking ? null : await candidateFor(input.actor.schoolId, row.studentId);
    return { assignment: serializeAssignment(row, { includeCandidate: !row.blindMarking, candidate }), status: evaluation?.status ?? "assigned", draftVersion: evaluation?.draftVersion ?? 0, totalMarks: evaluation?.totalMarks ?? null, unmarkedQuestionCount: evaluation?.unmarkedQuestionCount ?? (source.eligible && source.definition ? questionCatalog(source.definition).length : null), submittedAt: evaluation?.submittedAt ?? null, eligibility: { eligible: source.eligible, reason: source.reason, pageCount: source.pages.length } };
  }));
}

export async function getMarkerEvaluation(input: { actor: AssessmentMarkingMarkerActor; markingAssignmentId: Types.ObjectId }) {
  assertMarker(input.actor);
  const assignment = await loadAssignmentForMarker(input.actor, input.markingAssignmentId);
  return detailFor({ actor: input.actor, assignment, includeCandidate: !assignment.blindMarking });
}

export async function getAdminEvaluation(input: { actor: AssessmentMarkingAdminActor; markingEvaluationId: Types.ObjectId }) {
  assertAdmin(input.actor);
  const evaluation = await AssessmentMarkingEvaluation.findOne({ _id: oid(input.markingEvaluationId, "Marking evaluation id"), schoolId: input.actor.schoolId }).lean<IAssessmentMarkingEvaluation | null>();
  if (!evaluation) throw new AssessmentMarkingError("Marking evaluation not found", 404);
  const assignment = await loadAssignmentForAdmin(input.actor, evaluation.markingAssignmentId);
  const detail = await detailFor({ actor: input.actor, assignment, includeCandidate: true });
  const reviewerAssignments = await AssessmentMarkingReviewerAssignment.find({ schoolId: input.actor.schoolId, markingAssignmentId: assignment._id }).sort({ createdAt: 1 }).lean<IAssessmentMarkingReviewerAssignment[]>();
  const reviewers = await Promise.all(reviewerAssignments.map(async (row) => serializeReviewerAssignment(row, await markerNameFor(input.actor.schoolId, row.reviewerUserId))));
  const approved = await AssessmentApprovedMarkingOutcome.findOne({ schoolId: input.actor.schoolId, markingEvaluationId: evaluation._id, status: "current" }).lean<IAssessmentApprovedMarkingOutcome | null>();
  const handoffReceipt = approved ? await AssessmentScoreHandoffReceipt.findOne({ schoolId: input.actor.schoolId, sourceOutcomeId: approved._id, status: "completed" }).lean<IAssessmentScoreHandoffReceipt | null>() : null;
  return { ...detail, moderation: { reviewerAssignments: reviewers, approvedOutcome: approved ? serializeApprovedOutcome(approved) : null, handoffReceipt: handoffReceipt ? serializeHandoffReceiptForMarking(handoffReceipt) : null } };
}

function serializeHandoffReceiptForMarking(receipt: IAssessmentScoreHandoffReceipt) {
  return {
    id: String(receipt._id),
    status: receipt.status,
    coreAssessmentScoreId: receipt.coreAssessmentScoreId ? String(receipt.coreAssessmentScoreId) : null,
    appliedScore: receipt.appliedScore,
    appliedMaximumMarks: receipt.appliedMaximumMarks,
    scalingMethod: receipt.scaling.method,
    outcomeIntegrityReference: receipt.outcomeIntegrityReference,
    completedAt: receipt.completedAt,
  };
}

export async function getApprovedMarkingOutcome(input: { actor: AssessmentMarkingAdminActor; markingEvaluationId: Types.ObjectId }) {
  assertAdmin(input.actor);
  const evaluationId = oid(input.markingEvaluationId, "Marking evaluation id");
  const outcome = await AssessmentApprovedMarkingOutcome.findOne({ schoolId: input.actor.schoolId, markingEvaluationId: evaluationId, status: "current" }).lean<IAssessmentApprovedMarkingOutcome | null>();
  if (!outcome) throw new AssessmentMarkingError("Approved marking outcome not found", 404);
  return serializeApprovedOutcome(outcome);
}

export async function saveMarkingDraft(input: { actor: AssessmentMarkingMarkerActor; markingAssignmentId: Types.ObjectId; expectedDraftVersion: number; questionScores: Array<{ questionId: string; score?: number | null; feedback?: string | null }>; auditContext?: AuditRequestContext }) {
  assertMarker(input.actor);
  const assignment = await loadAssignmentForMarker(input.actor, input.markingAssignmentId);
  if (!Number.isInteger(input.expectedDraftVersion) || input.expectedDraftVersion < 0) throw new AssessmentMarkingError("A valid draft version is required", 400);
  const source = await sourceForAssignment({ schoolId: input.actor.schoolId, markingAssignment: assignment });
  if (!source.eligible || !source.definition) throw new AssessmentMarkingError(source.reason ?? "The script is not eligible for marking", 409);
  const scores = normalizedScores(source.definition, input.questionScores);
  return transaction(async (session) => {
    const current = await AssessmentMarkingEvaluation.findOne({ schoolId: input.actor.schoolId, markingAssignmentId: assignment._id }).session(session);
    if (!current) {
      if (input.expectedDraftVersion !== 0) throw new AssessmentMarkingError("The marking draft is stale; reload the assignment", 409);
      const created = new AssessmentMarkingEvaluation({ schoolId: input.actor.schoolId, markingAssignmentId: assignment._id, assessmentDefinitionVersionId: assignment.assessmentDefinitionVersionId, assessmentDeliveryVersionId: assignment.assessmentDeliveryVersionId, packetAssignmentId: assignment.packetAssignmentId, studentId: assignment.studentId, markerUserId: assignment.markerUserId, status: "in_progress", blindMarking: assignment.blindMarking, draftVersion: 1, questionScores: scores.scores, totalMarks: scores.totalMarks, unmarkedQuestionCount: scores.unmarkedQuestionCount, lastSavedAt: new Date(), submittedRevision: null, submittedAt: null, returnedAt: null, returnReason: null, reviewedBy: null, reviewedAt: null, reviewDecision: null, approvedAt: null });
      await created.save({ session });
      await writeTransactionalAuditEvent(session, { actionCode: "assessment.marking.draft_saved", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentMarkingEvaluation", targetEntityId: created._id, secondaryEntityType: "AssessmentMarkingAssignment", secondaryEntityId: assignment._id }, context: context(input.actor, { idempotencyKey: `draft:${created._id}:${created.draftVersion}`, context: input.auditContext }, "teacher", `saved:${created._id}`), payload: { metadata: { markingAssignmentId: String(assignment._id), draftVersion: created.draftVersion, totalMarks: created.totalMarks, unmarkedQuestionCount: created.unmarkedQuestionCount } }, streamKey: `school:${String(input.actor.schoolId)}` });
      return { evaluation: created.toObject() as IAssessmentMarkingEvaluation, replayed: false };
    }
    if (!["assigned", "in_progress", "returned"].includes(current.status)) throw new AssessmentMarkingError("Only an assigned, in-progress or returned evaluation can be edited", 409);
    if (current.draftVersion !== input.expectedDraftVersion) throw new AssessmentMarkingError("The marking draft is stale; reload before saving", 409);
    current.questionScores = scores.scores; current.totalMarks = scores.totalMarks; current.unmarkedQuestionCount = scores.unmarkedQuestionCount; current.draftVersion += 1; current.lastSavedAt = new Date(); current.status = "in_progress"; await current.save({ session });
    await writeTransactionalAuditEvent(session, { actionCode: "assessment.marking.draft_saved", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentMarkingEvaluation", targetEntityId: current._id, secondaryEntityType: "AssessmentMarkingAssignment", secondaryEntityId: assignment._id }, context: context(input.actor, { idempotencyKey: `draft:${current._id}:${current.draftVersion}`, context: input.auditContext }, "teacher", `saved:${current._id}`), payload: { metadata: { markingAssignmentId: String(assignment._id), draftVersion: current.draftVersion, totalMarks: current.totalMarks, unmarkedQuestionCount: current.unmarkedQuestionCount } }, streamKey: `school:${String(input.actor.schoolId)}` });
    return { evaluation: current.toObject() as IAssessmentMarkingEvaluation, replayed: false };
  });
}

export async function submitMarkingEvaluation(input: { actor: AssessmentMarkingMarkerActor; markingAssignmentId: Types.ObjectId; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertMarker(input.actor);
  const assignment = await loadAssignmentForMarker(input.actor, input.markingAssignmentId);
  const idempotencyKey = key(input.idempotencyKey, "marking submission idempotency key");
  const source = await sourceForAssignment({ schoolId: input.actor.schoolId, markingAssignment: assignment });
  if (!source.eligible) throw new AssessmentMarkingError(source.reason ?? "The script is not eligible for marking", 409);
  return transaction(async (session) => {
    const current = await AssessmentMarkingEvaluation.findOne({ schoolId: input.actor.schoolId, markingAssignmentId: assignment._id }).session(session);
    if (!current) throw new AssessmentMarkingError("Save marking progress before submitting", 409);
    const replay = await AssessmentMarkingRevision.findOne({ schoolId: input.actor.schoolId, markingAssignmentId: assignment._id, idempotencyKey }).session(session).lean<IAssessmentMarkingRevision | null>();
    if (replay) {
      if (replay.kind !== "submitted" || !same(replay.actorUserId, input.actor.userId)) throw new AssessmentMarkingError("The submission idempotency key is already bound to another action", 409);
      return { evaluation: current.toObject() as IAssessmentMarkingEvaluation, revision: replay, replayed: true };
    }
    if (!["in_progress", "returned"].includes(current.status)) throw new AssessmentMarkingError("Only an in-progress or returned evaluation can be submitted", 409);
    if (current.unmarkedQuestionCount > 0 || current.questionScores.length === 0) throw new AssessmentMarkingError("Every question must be marked before submission; unmarked is not the same as zero", 409);
    const latest = await AssessmentMarkingRevision.findOne({ schoolId: input.actor.schoolId, markingAssignmentId: assignment._id }).sort({ revisionNumber: -1 }).session(session).lean<{ revisionNumber: number } | null>();
    const revision = new AssessmentMarkingRevision({ schoolId: input.actor.schoolId, markingAssignmentId: assignment._id, markingEvaluationId: current._id, revisionNumber: (latest?.revisionNumber ?? 0) + 1, kind: "submitted", questionScores: current.questionScores, totalMarks: current.totalMarks, unmarkedQuestionCount: current.unmarkedQuestionCount, actorUserId: input.actor.userId, reason: null, idempotencyKey, createdAt: new Date() });
    await revision.save({ session });
    current.status = "submitted"; current.submittedRevision = revision.revisionNumber; current.submittedAt = new Date(); current.returnReason = null; current.returnedAt = null; await current.save({ session });
    await writeTransactionalAuditEvent(session, { actionCode: "assessment.marking.submitted", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentMarkingEvaluation", targetEntityId: current._id, secondaryEntityType: "AssessmentMarkingRevision", secondaryEntityId: revision._id }, context: context(input.actor, { idempotencyKey, context: input.auditContext }, "teacher", `submitted:${revision._id}`), payload: { metadata: { markingAssignmentId: String(assignment._id), revisionNumber: revision.revisionNumber, totalMarks: current.totalMarks, unmarkedQuestionCount: current.unmarkedQuestionCount } }, streamKey: `school:${String(input.actor.schoolId)}` });
    return { evaluation: current.toObject() as IAssessmentMarkingEvaluation, revision: revision.toObject() as IAssessmentMarkingRevision, replayed: false };
  });
}

function assertReviewSource(input: { assignment: IAssessmentMarkingAssignment; evaluation: IAssessmentMarkingEvaluation; source: Awaited<ReturnType<typeof sourceForAssignment>> }) {
  const { assignment, evaluation, source } = input;
  if (!source.eligible || !source.delivery || !source.definition || !source.packetAssignment || !source.packet || !source.evidenceProvenance) throw new AssessmentMarkingError(source.reason ?? "The marking source is no longer eligible", 409);
  if (assignment.status !== "active") throw new AssessmentMarkingError("The marking assignment is no longer active", 409);
  if (!same(assignment.assessmentDefinitionVersionId, source.definition._id) || !same(assignment.assessmentDeliveryVersionId, source.delivery._id) || !same(assignment.assessmentPaperPacketId, source.packet._id) || !same(assignment.packetAssignmentId, source.packetAssignment._id) || !same(assignment.studentId, source.packetAssignment.studentId)) throw new AssessmentMarkingError("The marking assignment no longer matches the authoritative candidate delivery", 409);
  if (!same(evaluation.assessmentDefinitionVersionId, source.definition._id) || !same(evaluation.assessmentDeliveryVersionId, source.delivery._id) || !same(evaluation.packetAssignmentId, source.packetAssignment._id) || !same(evaluation.studentId, source.packetAssignment.studentId) || !same(evaluation.markerUserId, assignment.markerUserId)) throw new AssessmentMarkingError("The evaluation no longer matches the authoritative candidate delivery", 409);
  const catalog = questionCatalog(source.definition);
  if (evaluation.questionScores.length !== catalog.length || evaluation.unmarkedQuestionCount !== 0) throw new AssessmentMarkingError("Every published question must have a numeric score before approval", 409);
  let total = 0;
  for (const [index, score] of evaluation.questionScores.entries()) {
    const question = catalog[index];
    if (!question || score.questionId !== question.questionId || score.criteriaDigest !== question.criteriaDigest || score.maximumMarks !== question.marks || score.score == null || score.score < 0 || score.score > question.marks) throw new AssessmentMarkingError("The submitted score set no longer matches the published question catalog", 409);
    total += score.score;
  }
  if (evaluation.totalMarks == null || Math.abs(evaluation.totalMarks - total) > 1e-9) throw new AssessmentMarkingError("The submitted total is not server-consistent", 409);
  return { catalog, total };
}

function outcomeDigests(input: { schoolId: Types.ObjectId; assignment: IAssessmentMarkingAssignment; evaluation: IAssessmentMarkingEvaluation; revision: IAssessmentMarkingRevision; source: Awaited<ReturnType<typeof sourceForAssignment>>; catalog: QuestionDescriptor[] }) {
  const source = input.source;
  if (!source.delivery || !source.definition || !source.evidenceProvenance) throw new AssessmentMarkingError("Approved outcome provenance is incomplete", 409);
  const questionCatalogDigest = hashAssessmentDefinition(input.catalog.map((question) => ({ questionId: question.questionId, questionOrder: question.questionOrder, maximumMarks: question.marks, criteriaDigest: question.criteriaDigest })));
  const evidenceProvenanceDigest = hashAssessmentDefinition(source.evidenceProvenance.map((entry) => ({ evidencePageId: String(entry.evidencePageId), pageId: entry.pageId, pageNumber: entry.pageNumber, assetId: String(entry.assetId), receiptId: String(entry.receiptId), digest: entry.digest, sizeBytes: entry.sizeBytes })));
  const integrityReference = hashAssessmentDefinition({ schoolId: String(input.schoolId), definitionId: String(source.definition._id), definitionContentHash: source.definition.contentHash, deliveryId: String(source.delivery._id), deliveryContentHash: source.delivery.contentHash, packetId: String(source.packet._id), packetAssignmentId: String(source.packetAssignment?._id), markingAssignmentId: String(input.assignment._id), markingEvaluationId: String(input.evaluation._id), approvedRevisionId: String(input.revision._id), approvedRevisionNumber: input.revision.revisionNumber, questionCatalogDigest, evidenceProvenanceDigest, questionScores: serializedScores(input.evaluation.questionScores), totalMarks: input.evaluation.totalMarks, maximumAvailableMarks: source.definition.scoring.maximumMarks });
  return { questionCatalogDigest, evidenceProvenanceDigest, integrityReference };
}

export async function reviewMarkingEvaluation(input: { actor: AssessmentMarkingAdminActor; markingEvaluationId: Types.ObjectId; decision: "approve" | "return"; reason: string; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertAdmin(input.actor);
  const evaluationId = oid(input.markingEvaluationId, "Marking evaluation id");
  const reason = input.reason.trim();
  const idempotencyKey = key(input.idempotencyKey, "marking review idempotency key");
  if (reason.length < 3 || reason.length > 2000) throw new AssessmentMarkingError("A review reason is required", 400);
  return transaction(async (session) => {
    const current = await AssessmentMarkingEvaluation.findOne({ _id: evaluationId, schoolId: input.actor.schoolId }).session(session);
    if (!current) throw new AssessmentMarkingError("Marking evaluation not found", 404);
    const assignment = await AssessmentMarkingAssignment.findOne({ _id: current.markingAssignmentId, schoolId: input.actor.schoolId }).session(session).lean<IAssessmentMarkingAssignment | null>();
    if (!assignment) throw new AssessmentMarkingError("Marking assignment not found", 404);
    const replay = await AssessmentMarkingRevision.findOne({ schoolId: input.actor.schoolId, markingAssignmentId: assignment._id, idempotencyKey }).session(session).lean<IAssessmentMarkingRevision | null>();
    if (replay) {
      if (same(replay.actorUserId, input.actor.userId) === false || replay.kind !== (input.decision === "approve" ? "approved" : "returned") || replay.reason !== reason) throw new AssessmentMarkingError("The review idempotency key is already bound to another decision", 409);
      const approved = replay.kind === "approved" ? await AssessmentApprovedMarkingOutcome.findOne({ schoolId: input.actor.schoolId, approvedRevisionId: replay._id }).session(session).lean<IAssessmentApprovedMarkingOutcome | null>() : null;
      return { evaluation: current.toObject() as IAssessmentMarkingEvaluation, revision: replay, approvedOutcome: approved ? serializeApprovedOutcome(approved) : null, replayed: true };
    }
    if (same(current.markerUserId, input.actor.userId)) throw new AssessmentMarkingError("A marker cannot approve or return their own evaluation", 403);
    if (current.status !== "submitted") throw new AssessmentMarkingError("Only submitted evaluations can be reviewed", 409);
    const reviewerAssignment = await AssessmentMarkingReviewerAssignment.findOne({ schoolId: input.actor.schoolId, markingAssignmentId: assignment._id, reviewerUserId: input.actor.userId, status: "active" }).session(session).lean<IAssessmentMarkingReviewerAssignment | null>();
    if (!reviewerAssignment) throw new AssessmentMarkingError("This script has not been explicitly assigned to the reviewing administrator", 403);
    if (!same(reviewerAssignment.assessmentDeliveryVersionId, assignment.assessmentDeliveryVersionId) || !same(reviewerAssignment.assessmentDefinitionVersionId, assignment.assessmentDefinitionVersionId) || !same(reviewerAssignment.packetAssignmentId, assignment.packetAssignmentId)) throw new AssessmentMarkingError("Reviewer authority does not match the marking delivery", 403);
    await loadReviewer(input.actor.userId, input.actor.schoolId, session);
    const source = await sourceForAssignment({ schoolId: input.actor.schoolId, markingAssignment: assignment, session });
    const { catalog, total } = assertReviewSource({ assignment, evaluation: current.toObject() as IAssessmentMarkingEvaluation, source });
    const fenced = await fenceActivePacketAssignment({
      session,
      schoolId: input.actor.schoolId,
      assignmentId: source.packetAssignment!._id,
      deliveryId: source.delivery!._id,
      studentId: source.packetAssignment!.studentId,
    });
    if (!fenced) throw new AssessmentMarkingError("The candidate assignment changed before moderation completed", 409);
    const now = new Date();
    const latest = await AssessmentMarkingRevision.findOne({ schoolId: input.actor.schoolId, markingAssignmentId: assignment._id }).sort({ revisionNumber: -1 }).session(session).lean<{ revisionNumber: number } | null>();
    const revision = new AssessmentMarkingRevision({ schoolId: input.actor.schoolId, markingAssignmentId: assignment._id, markingEvaluationId: current._id, revisionNumber: (latest?.revisionNumber ?? 0) + 1, kind: input.decision === "approve" ? "approved" : "returned", questionScores: current.questionScores, totalMarks: total, unmarkedQuestionCount: current.unmarkedQuestionCount, actorUserId: input.actor.userId, reason, idempotencyKey, createdAt: now });
    await revision.save({ session });
    let approvedOutcome: HydratedDocument<IAssessmentApprovedMarkingOutcome> | null = null;
    const digests = outcomeDigests({ schoolId: input.actor.schoolId, assignment, evaluation: current.toObject() as IAssessmentMarkingEvaluation, revision: revision.toObject() as IAssessmentMarkingRevision, source, catalog });
    if (input.decision === "approve") {
      approvedOutcome = new AssessmentApprovedMarkingOutcome({ schoolId: input.actor.schoolId, assessmentDefinitionVersionId: source.definition!._id, assessmentDeliveryVersionId: source.delivery!._id, assessmentPaperPacketId: source.packet!._id, packetAssignmentId: source.packetAssignment!._id, studentId: source.packetAssignment!.studentId, markingAssignmentId: assignment._id, markingEvaluationId: current._id, reviewerAssignmentId: reviewerAssignment._id, approvedRevisionId: revision._id, approvedRevisionNumber: revision.revisionNumber, outcomeKey: `marking:${String(current._id)}:revision:${revision.revisionNumber}`, questionScores: current.questionScores, maximumAvailableMarks: source.definition!.scoring.maximumMarks, totalMarks: total, unmarkedQuestionCount: current.unmarkedQuestionCount, definitionContentHash: source.definition!.contentHash, deliveryContentHash: source.delivery!.contentHash, questionCatalogDigest: digests.questionCatalogDigest, evidenceProvenance: source.evidenceProvenance, evidenceProvenanceDigest: digests.evidenceProvenanceDigest, integrityReference: digests.integrityReference, approvedBy: input.actor.userId, approvedAt: now, status: "current", coreResultStatus: "not_written", scoreHandoffStatus: "not_authorized" });
      await approvedOutcome.save({ session });
    }
    current.status = input.decision === "approve" ? "approved" : "returned"; current.reviewedBy = input.actor.userId; current.reviewedAt = now; current.reviewDecision = input.decision === "approve" ? "approved" : "returned"; current.approvedAt = input.decision === "approve" ? now : null; current.returnedAt = input.decision === "return" ? now : null; current.returnReason = input.decision === "return" ? reason : null; await current.save({ session });
    const resultStatus = input.decision === "approve" ? "approved" : "returned";
    await writeTransactionalAuditEvent(session, { actionCode: input.decision === "approve" ? "assessment.marking.approved" : "assessment.marking.returned", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentMarkingEvaluation", targetEntityId: current._id, secondaryEntityType: "AssessmentMarkingRevision", secondaryEntityId: revision._id }, context: context(input.actor, { idempotencyKey, context: input.auditContext }, "school_admin", `${input.decision}:${revision._id}`), reason: { reasonCode: input.decision === "approve" ? "marking_approved" : "marking_returned", reason }, approval: { reviewedById: input.actor.userId, reviewedByRole: "school_admin" }, payload: { before: { status: "submitted", markingEvaluationId: String(current._id), markingRevisionId: String(revision._id) }, after: { status: resultStatus, markingEvaluationId: String(current._id), markingRevisionId: String(revision._id), approvedOutcomeId: approvedOutcome ? String(approvedOutcome._id) : null }, changedFields: ["status", "reviewedBy", "reviewedAt", "reviewDecision", ...(input.decision === "approve" ? ["approvedOutcomeId"] : ["returnReason"])], metadata: { assessmentDefinitionVersionId: String(assignment.assessmentDefinitionVersionId), assessmentDeliveryVersionId: String(assignment.assessmentDeliveryVersionId), assessmentPaperPacketId: String(assignment.assessmentPaperPacketId), packetAssignmentId: String(assignment.packetAssignmentId), markingAssignmentId: String(assignment._id), markingEvaluationId: String(current._id), markingRevisionId: String(revision._id), moderationAssignmentId: String(reviewerAssignment._id), reviewerUserId: String(input.actor.userId), previousStatus: "submitted", resultingStatus: resultStatus, revisionNumber: revision.revisionNumber, totalMarks: total, maximumAvailableMarks: source.definition!.scoring.maximumMarks, unmarkedQuestionCount: current.unmarkedQuestionCount, evidenceProvenanceDigest: digests.evidenceProvenanceDigest, integrityReference: digests.integrityReference, coreResultStatus: "not_written", scoreHandoffStatus: "not_authorized" } }, streamKey: `school:${String(input.actor.schoolId)}` });
    const reviewerDoc = await AssessmentMarkingReviewerAssignment.findOne({ _id: reviewerAssignment._id, schoolId: input.actor.schoolId }).session(session);
    if (reviewerDoc) { if (input.decision === "approve") { reviewerDoc.status = "completed"; reviewerDoc.completedAt = now; } await reviewerDoc.save({ session }); }
    return { evaluation: current.toObject() as IAssessmentMarkingEvaluation, revision: revision.toObject() as IAssessmentMarkingRevision, approvedOutcome: approvedOutcome ? serializeApprovedOutcome(approvedOutcome.toObject() as IAssessmentApprovedMarkingOutcome) : null, replayed: false };
  });
}

function signedTtlSeconds() {
  if (isR2Configured()) return getR2Config().signedUrlTtlSeconds;
  const raw = process.env.R2_SIGNED_URL_TTL_SECONDS?.trim();
  const ttl = raw ? Number(raw) : DEFAULT_SIGNED_URL_TTL_SECONDS;
  return Number.isFinite(ttl) && ttl >= 30 && ttl <= 900 ? ttl : DEFAULT_SIGNED_URL_TTL_SECONDS;
}

export async function getMarkingEvidencePreview(input: { actor: AssessmentMarkingMarkerActor | AssessmentMarkingAdminActor; markingAssignmentId: Types.ObjectId; evidencePageId: Types.ObjectId }) {
  if ("teacherId" in input.actor) assertMarker(input.actor); else assertAdmin(input.actor);
  const assignment = "teacherId" in input.actor ? await loadAssignmentForMarker(input.actor, input.markingAssignmentId) : await loadAssignmentForAdmin(input.actor, input.markingAssignmentId);
  const source = await sourceForAssignment({ schoolId: input.actor.schoolId, markingAssignment: assignment });
  if (!source.eligible) throw new AssessmentMarkingError(source.reason ?? "The script is not eligible for marking", 409);
  const pageId = oid(input.evidencePageId, "Evidence page id");
  const page = source.pages.find((candidate) => same(candidate._id, pageId));
  if (!page || !page.assetId) throw new AssessmentMarkingError("Verified evidence page not found for this marking assignment", 404);
  const asset = await StoredAsset.findOne({ _id: page.assetId, schoolId: input.actor.schoolId, kind: "assess_script_page", visibility: "private", status: "ready", association: { type: "assessmentEvidencePage", id: page._id } }).lean();
  if (!asset) throw new AssessmentMarkingError("Private evidence is not ready", 409);
  const signed = await getR2Port().createPresignedGet({ key: asset.storageKey, expiresInSeconds: signedTtlSeconds(), contentDisposition: contentDispositionValue(asset.fileName, "inline"), contentType: asset.mimeType });
  return { redirectUrl: signed.url, expiresInSeconds: signed.expiresInSeconds, page: { id: String(page._id), pageId: page.pageId, pageNumber: page.expectedPageNumber } };
}
