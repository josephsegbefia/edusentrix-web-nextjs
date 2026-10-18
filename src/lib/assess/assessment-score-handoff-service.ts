import { randomUUID } from "node:crypto";
import mongoose, { Types, type ClientSession } from "mongoose";
import { AssessmentApprovedMarkingOutcome, type IAssessmentApprovedMarkingOutcome } from "@/models/AssessmentApprovedMarkingOutcome";
import { AssessmentDefinitionVersion, type IAssessmentDefinitionVersion } from "@/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion, type IAssessmentDeliveryVersion } from "@/models/AssessmentDeliveryVersion";
import { AssessmentEvidencePage, type IAssessmentEvidencePage } from "@/models/AssessmentEvidencePage";
import { AssessmentEvidenceReceipt } from "@/models/AssessmentEvidenceReceipt";
import { AssessmentItem, type IAssessmentItem } from "@/models/AssessmentItem";
import { AssessmentMarkingAssignment, type IAssessmentMarkingAssignment } from "@/models/AssessmentMarkingAssignment";
import { AssessmentMarkingEvaluation, type IAssessmentMarkingEvaluation } from "@/models/AssessmentMarkingEvaluation";
import { AssessmentMarkingRevision, type IAssessmentMarkingRevision } from "@/models/AssessmentMarkingRevision";
import { AssessmentMarkingReviewerAssignment, type IAssessmentMarkingReviewerAssignment } from "@/models/AssessmentMarkingReviewerAssignment";
import { AssessmentPaperPacket, type IAssessmentPaperPacket } from "@/models/AssessmentPaperPacket";
import { AssessmentPaperPacketAssignment, type IAssessmentPaperPacketAssignment } from "@/models/AssessmentPaperPacketAssignment";
import { AssessmentPaperPacketCorrection } from "@/models/AssessmentPaperPacketCorrection";
import { AssessmentPlan, type IAssessmentPlan } from "@/models/AssessmentPlan";
import { AssessmentScore, type IAssessmentScore } from "@/models/AssessmentScore";
import { AssessmentScoreHandoffReceipt, type IAssessmentScoreHandoffReceipt } from "@/models/AssessmentScoreHandoffReceipt";
import { Student } from "@/models/Student";
import { StoredAsset } from "@/models/StoredAsset";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { writeAssessmentScoreFromAuthorizedHandoff, AssessmentScoreWriteConflictError } from "@/lib/academics/assessment-engine/assessment-score-service";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import type { AuditRequestContext } from "@/lib/audit/types";
import { fenceActivePacketAssignment } from "@/lib/assess/assessment-packet-assignment-fence";

const TRANSACTION_OPTIONS = {
  readConcern: { level: "snapshot" as const },
  writeConcern: { w: "majority" as const },
  maxCommitTimeMS: 10_000,
};

const ACTIVE_PLAN_STATUSES = new Set(["active", "locked"]);
const ACTIVE_ITEM_STATUSES = new Set(["open", "completed", "submitted"]);
const ACTIVE_DELIVERY_STATUSES = new Set(["published", "active"]);

export class AssessmentScoreHandoffError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 503;

  constructor(message: string, status: 400 | 403 | 404 | 409 | 503 = 409) {
    super(message);
    this.name = "AssessmentScoreHandoffError";
    this.status = status;
  }
}

export type AssessmentScoreHandoffActor = {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  isAdmin: boolean;
  premiumPublicationEntitled: boolean;
};

type HandoffInput = {
  actor: AssessmentScoreHandoffActor;
  approvedOutcomeId: Types.ObjectId;
  requestIdempotencyKey: string;
  auditContext?: AuditRequestContext;
  /** Test-only deterministic transaction failure injection. Never supplied by routes. */
  failureInjection?: "after_core_score" | "after_receipt_save";
};

function oid(value: Types.ObjectId | string | null | undefined, label: string) {
  if (!value || !Types.ObjectId.isValid(String(value))) {
    throw new AssessmentScoreHandoffError(`${label} is invalid`, 400);
  }
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}

function same(left: unknown, right: unknown) {
  return String(left) === String(right);
}

function duplicate(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: number }).code === 11000);
}

function transient(error: unknown) {
  const value = error as { errorLabels?: unknown; message?: string } | null;
  const message = String(value?.message ?? "").toLowerCase();
  return (Array.isArray(value?.errorLabels) &&
    (value.errorLabels.includes("TransientTransactionError") || value.errorLabels.includes("UnknownTransactionCommitResult"))) ||
    message.includes("write conflict") ||
    message.includes("temporarily unavailable");
}

function transactionUnavailable(error: unknown) {
  const value = error as { code?: number; message?: string } | null;
  const message = String(value?.message ?? "").toLowerCase();
  return value?.code === 20 || value?.code === 303 ||
    message.includes("transactions are not supported") ||
    message.includes("transaction numbers are only allowed");
}

async function transaction<T>(callback: (session: ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let last: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await session.withTransaction(() => callback(session), TRANSACTION_OPTIONS);
      } catch (error) {
        last = error;
        if (!transient(error) || attempt === 4) throw error;
      }
    }
    throw last instanceof Error ? last : new Error("Score handoff transaction failed");
  } finally {
    await session.endSession();
  }
}

function assertActor(actor: AssessmentScoreHandoffActor) {
  if (!actor.isAdmin) throw new AssessmentScoreHandoffError("Only school administrators can hand off approved marks", 403);
  if (!actor.premiumPublicationEntitled) throw new AssessmentScoreHandoffError("Premium Assess score handoff entitlement is required", 403);
}

function requestKey(value: string) {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 240) {
    throw new AssessmentScoreHandoffError("A valid x-idempotency-key is required", 400);
  }
  return normalized;
}

function atMostTwoDecimals(value: number) {
  return Math.abs(value * 100 - Math.round(value * 100)) <= 1e-9;
}

function buildAuditContext(input: HandoffInput, sourceOperationId: string): AuditRequestContext {
  const supplied = input.auditContext;
  return {
    requestId: supplied?.requestId || randomUUID(),
    correlationId: supplied?.correlationId || supplied?.requestId || randomUUID(),
    idempotencyKey: `score-handoff:${sourceOperationId}`,
    actorType: "user",
    actorId: input.actor.userId,
    actorRole: "school_admin",
    actorEmail: supplied?.actorEmail ?? null,
    actorName: supplied?.actorName ?? null,
    schoolId: input.actor.schoolId,
    ipAddress: supplied?.ipAddress ?? null,
    userAgent: supplied?.userAgent ?? null,
    routePath: supplied?.routePath ?? null,
    clientSurface: supplied?.clientSurface ?? "api",
  };
}

export function serializeScoreHandoffReceipt(receipt: IAssessmentScoreHandoffReceipt) {
  return {
    id: String(receipt._id),
    status: receipt.status,
    sourceOutcomeId: String(receipt.sourceOutcomeId),
    approvedRevisionId: String(receipt.approvedRevisionId),
    assessmentDefinitionVersionId: String(receipt.assessmentDefinitionVersionId),
    assessmentDeliveryVersionId: String(receipt.assessmentDeliveryVersionId),
    studentId: String(receipt.studentId),
    assessmentPlanId: String(receipt.assessmentPlanId),
    assessmentItemId: String(receipt.assessmentItemId),
    coreAssessmentScoreId: receipt.coreAssessmentScoreId ? String(receipt.coreAssessmentScoreId) : null,
    sourceTotalMarks: receipt.sourceTotalMarks,
    sourceMaximumMarks: receipt.sourceMaximumMarks,
    appliedScore: receipt.appliedScore,
    appliedMaximumMarks: receipt.appliedMaximumMarks,
    scaling: receipt.scaling,
    sourceOperationId: receipt.sourceOperationId,
    outcomeIntegrityReference: receipt.outcomeIntegrityReference,
    auditEventId: String(receipt.auditEventId),
    completedAt: receipt.completedAt,
    failureCode: receipt.failureCode,
  };
}

async function assertHandoffActor(input: HandoffInput, session: ClientSession) {
  const [user, membership] = await Promise.all([
    User.findOne({ _id: input.actor.userId, schoolId: input.actor.schoolId }).select("_id").session(session).lean(),
    UserMembership.findOne({ userId: input.actor.userId, schoolId: input.actor.schoolId, status: "active", roles: "school_admin" }).select("_id").session(session).lean(),
  ]);
  if (!user || !membership) throw new AssessmentScoreHandoffError("Active school-admin membership is required for score handoff", 403);
}

async function loadCompletedReceipt(input: { schoolId: Types.ObjectId; sourceOperationId?: string; requestIdempotencyKey?: string }, session: ClientSession) {
  const query: Record<string, unknown> = { schoolId: input.schoolId, status: "completed" };
  if (input.sourceOperationId) query.sourceOperationId = input.sourceOperationId;
  if (input.requestIdempotencyKey) query.requestIdempotencyKey = input.requestIdempotencyKey;
  return AssessmentScoreHandoffReceipt.findOne(query).session(session).lean<IAssessmentScoreHandoffReceipt | null>();
}

async function validateEvidence(input: {
  schoolId: Types.ObjectId;
  outcome: IAssessmentApprovedMarkingOutcome;
  delivery: IAssessmentDeliveryVersion;
  packet: IAssessmentPaperPacket;
  packetAssignment: IAssessmentPaperPacketAssignment;
  session: ClientSession;
}) {
  const { schoolId, outcome, delivery, packet, packetAssignment, session } = input;
  const provenance = outcome.evidenceProvenance;
  if (!provenance.length || provenance.length !== packet.pageManifest.length) {
    throw new AssessmentScoreHandoffError("Approved evidence provenance is incomplete", 409);
  }
  const pageIds = provenance.map((entry) => entry.evidencePageId);
  const pages = await AssessmentEvidencePage.find({
    _id: { $in: pageIds },
    schoolId,
    assessmentDeliveryVersionId: delivery._id,
    packetId: packet._id,
    assignmentId: packetAssignment._id,
    accepted: true,
    status: "verified",
    integrityStatus: "verified",
  }).session(session).lean<IAssessmentEvidencePage[]>();
  const pageById = new Map(pages.map((page) => [String(page._id), page]));
  if (pages.length !== provenance.length) throw new AssessmentScoreHandoffError("Approved evidence pages are no longer verified", 409);
  const receipts = await AssessmentEvidenceReceipt.find({ schoolId, evidencePageId: { $in: pageIds }, status: "confirmed" }).session(session).lean();
  const receiptByPageId = new Map(receipts.map((receipt) => [String(receipt.evidencePageId), receipt]));
  const assets = await StoredAsset.find({
    _id: { $in: provenance.map((entry) => entry.assetId) },
    schoolId,
    kind: "assess_script_page",
    visibility: "private",
    status: "ready",
    "association.type": "assessmentEvidencePage",
  }).session(session).lean();
  const assetById = new Map(assets.map((asset) => [String(asset._id), asset]));
  const manifestIds = new Set(packet.pageManifest.map((entry) => entry.pageId));
  for (const entry of provenance) {
    const page = pageById.get(String(entry.evidencePageId));
    const receipt = receiptByPageId.get(String(entry.evidencePageId));
    const asset = assetById.get(String(entry.assetId));
    if (!page || !receipt || !asset || !manifestIds.has(entry.pageId)) {
      throw new AssessmentScoreHandoffError("Approved evidence provenance is no longer attached to the issued packet", 409);
    }
    if (String(page.pageId) !== entry.pageId || String(page.assetId) !== String(entry.assetId) || String(asset.association?.id) !== String(page._id)) {
      throw new AssessmentScoreHandoffError("Approved evidence asset association is inconsistent", 409);
    }
    if (page.verifiedDigest !== entry.digest || receipt.digest !== entry.digest || receipt.sizeBytes !== entry.sizeBytes || asset.sizeBytes !== entry.sizeBytes) {
      throw new AssessmentScoreHandoffError("Approved evidence integrity provenance has changed", 409);
    }
  }
}

async function validateSource(input: { outcomeId: Types.ObjectId; schoolId: Types.ObjectId; session: ClientSession }) {
  const { outcomeId, schoolId, session } = input;
  const outcome = await AssessmentApprovedMarkingOutcome.findOne({ _id: outcomeId, schoolId, status: "current" }).session(session).lean<IAssessmentApprovedMarkingOutcome | null>();
  if (!outcome) throw new AssessmentScoreHandoffError("A current approved marking outcome was not found", 404);

  const [delivery, definition] = await Promise.all([
    AssessmentDeliveryVersion.findOne({ _id: outcome.assessmentDeliveryVersionId, schoolId, status: { $in: [...ACTIVE_DELIVERY_STATUSES] } }).session(session).lean<IAssessmentDeliveryVersion | null>(),
    AssessmentDefinitionVersion.findOne({ _id: outcome.assessmentDefinitionVersionId, schoolId, status: "published" }).session(session).lean<IAssessmentDefinitionVersion | null>(),
  ]);
  if (!delivery || delivery.resultBinding !== "score_bearing" || delivery.contentHash !== outcome.deliveryContentHash) {
    throw new AssessmentScoreHandoffError("The approved outcome is not attached to an active score-bearing delivery", 409);
  }
  if (!definition || definition.resultBinding !== "score_bearing" || definition.contentHash !== outcome.definitionContentHash) {
    throw new AssessmentScoreHandoffError("The approved outcome is not attached to the exact published definition", 409);
  }
  if (!same(delivery.assessmentDefinitionVersionId, definition._id) || !delivery.assessmentPlanId || !delivery.assessmentItemId ||
      !same(delivery.assessmentPlanId, definition.assessmentPlanId) || !same(delivery.assessmentItemId, definition.assessmentItemId)) {
    throw new AssessmentScoreHandoffError("The delivery does not have the required canonical academic binding", 409);
  }

  const [plan, item, student, packetAssignment, packet, markingAssignment, evaluation, reviewerAssignment, revision] = await Promise.all([
    AssessmentPlan.findOne({ _id: delivery.assessmentPlanId, schoolId }).session(session).lean<IAssessmentPlan | null>(),
    AssessmentItem.findOne({ _id: delivery.assessmentItemId, schoolId }).session(session).lean<IAssessmentItem | null>(),
    Student.findOne({ _id: outcome.studentId, schoolId, status: "active" }).select("_id gradeId classGroupId").session(session).lean(),
    AssessmentPaperPacketAssignment.findOne({ _id: outcome.packetAssignmentId, schoolId, status: "active" }).session(session).lean<IAssessmentPaperPacketAssignment | null>(),
    AssessmentPaperPacket.findOne({ _id: outcome.assessmentPaperPacketId, schoolId, assessmentDeliveryVersionId: delivery._id, status: "issued" }).session(session).lean<IAssessmentPaperPacket | null>(),
    AssessmentMarkingAssignment.findOne({ _id: outcome.markingAssignmentId, schoolId, status: "active" }).session(session).lean<IAssessmentMarkingAssignment | null>(),
    AssessmentMarkingEvaluation.findOne({ _id: outcome.markingEvaluationId, schoolId, status: "approved" }).session(session).lean<IAssessmentMarkingEvaluation | null>(),
    AssessmentMarkingReviewerAssignment.findOne({ _id: outcome.reviewerAssignmentId, schoolId, status: "completed" }).session(session).lean<IAssessmentMarkingReviewerAssignment | null>(),
    AssessmentMarkingRevision.findOne({ _id: outcome.approvedRevisionId, schoolId, markingAssignmentId: outcome.markingAssignmentId, kind: "approved" }).session(session).lean<IAssessmentMarkingRevision | null>(),
  ]);
  if (!plan || !ACTIVE_PLAN_STATUSES.has(plan.status)) throw new AssessmentScoreHandoffError("The canonical assessment plan is not active", 409);
  if (!item || !ACTIVE_ITEM_STATUSES.has(item.status)) throw new AssessmentScoreHandoffError("The canonical assessment item is not active", 409);
  if (!student) throw new AssessmentScoreHandoffError("The authoritative student identity is no longer eligible", 409);
  if (!same(item.assessmentPlanId, plan._id) || !same(item.academicPeriodId, delivery.academicPeriodId) || !same(item.academicPeriodId, definition.academicPeriodId) ||
      !same(item.subjectId, definition.subjectId) || !same(item.gradeId, definition.gradeId) || !same(student.gradeId, item.gradeId) || !same(student.classGroupId, item.classGroupId) ||
      !delivery.classGroupIds.some((classGroupId) => same(classGroupId, item.classGroupId))) {
    throw new AssessmentScoreHandoffError("The canonical academic binding no longer matches the approved delivery", 409);
  }
  if (!packetAssignment || !same(packetAssignment.assessmentDeliveryVersionId, delivery._id) || !same(packetAssignment.assessmentPaperPacketId, packet?._id) || !same(packetAssignment.studentId, student._id)) {
    throw new AssessmentScoreHandoffError("The candidate packet assignment is stale or reassigned", 409);
  }
  if (!packet) throw new AssessmentScoreHandoffError("The issued paper packet is unavailable", 409);
  const pendingCorrection = await AssessmentPaperPacketCorrection.findOne({ schoolId, assignmentId: packetAssignment._id, status: "pending" }).select("_id").session(session).lean();
  if (pendingCorrection) throw new AssessmentScoreHandoffError("Candidate identity correction is pending", 409);
  if (!markingAssignment || !same(markingAssignment.packetAssignmentId, packetAssignment._id) || !same(markingAssignment.studentId, student._id) || !same(markingAssignment.assessmentDeliveryVersionId, delivery._id)) {
    throw new AssessmentScoreHandoffError("The marking assignment is stale or reassigned", 409);
  }
  if (!evaluation || !same(evaluation.markingAssignmentId, markingAssignment._id) || !same(evaluation.studentId, student._id) || evaluation.unmarkedQuestionCount !== 0) {
    throw new AssessmentScoreHandoffError("The marking evaluation is incomplete or no longer approved", 409);
  }
  if (!reviewerAssignment || !same(reviewerAssignment.markingAssignmentId, markingAssignment._id) || same(reviewerAssignment.reviewerUserId, markingAssignment.markerUserId) || !same(reviewerAssignment.reviewerUserId, outcome.approvedBy)) {
    throw new AssessmentScoreHandoffError("Independent reviewer authorization is no longer valid", 409);
  }
  if (!revision || !same(revision.markingEvaluationId, evaluation._id) || revision.totalMarks == null || revision.unmarkedQuestionCount !== 0) {
    throw new AssessmentScoreHandoffError("The approved marking revision is incomplete", 409);
  }

  const sourceMaximumMarks = Number(outcome.maximumAvailableMarks);
  const targetMaximumMarks = Number(item.maxScore);
  if (!Number.isFinite(sourceMaximumMarks) || !Number.isFinite(targetMaximumMarks) || sourceMaximumMarks <= 0 || sourceMaximumMarks !== targetMaximumMarks || definition.scoring.maximumMarks !== targetMaximumMarks) {
    throw new AssessmentScoreHandoffError("The approved marks do not map unambiguously to the Core assessment maximum; no scaling rule is approved", 409);
  }
  let recomputedTotal = 0;
  for (const entry of outcome.questionScores) {
    const score = entry.score;
    const maximumMarks = entry.maximumMarks;
    if (score == null || maximumMarks == null || !Number.isFinite(score) || !Number.isFinite(maximumMarks) || score < 0 || score > maximumMarks || !atMostTwoDecimals(score)) {
      throw new AssessmentScoreHandoffError("The approved question scores contain an unsupported value or precision", 409);
    }
    recomputedTotal += score;
  }
  if (outcome.questionScores.length === 0 || Math.abs(recomputedTotal - outcome.totalMarks) > 1e-9 || Math.abs(outcome.totalMarks - revision.totalMarks) > 1e-9 || outcome.totalMarks > targetMaximumMarks) {
    throw new AssessmentScoreHandoffError("The approved total is not consistent with the immutable question scores", 409);
  }
  await validateEvidence({ schoolId, outcome, delivery, packet, packetAssignment, session });

  const currentOutcomes = await AssessmentApprovedMarkingOutcome.find({ schoolId, assessmentDeliveryVersionId: delivery._id, studentId: student._id, status: "current" }).select("_id").session(session).lean();
  if (currentOutcomes.length !== 1 || !same(currentOutcomes[0]?._id, outcome._id)) {
    throw new AssessmentScoreHandoffError("More than one current approved outcome targets this canonical student and delivery", 409);
  }

  return { outcome, definition, delivery, plan, item, student, packetAssignment, packet, markingAssignment, evaluation, reviewerAssignment, revision, sourceMaximumMarks, targetMaximumMarks };
}

function buildReceipt(input: {
  actor: AssessmentScoreHandoffActor;
  outcome: IAssessmentApprovedMarkingOutcome;
  definition: IAssessmentDefinitionVersion;
  delivery: IAssessmentDeliveryVersion;
  plan: IAssessmentPlan;
  item: IAssessmentItem;
  score: IAssessmentScore;
  sourceOperationId: string;
  requestIdempotencyKey: string;
  now: Date;
}) {
  return new AssessmentScoreHandoffReceipt({
    schoolId: input.actor.schoolId,
    sourceOutcomeId: input.outcome._id,
    approvedRevisionId: input.outcome.approvedRevisionId,
    assessmentDefinitionVersionId: input.definition._id,
    assessmentDeliveryVersionId: input.delivery._id,
    studentId: input.outcome.studentId,
    assessmentPlanId: input.plan._id,
    assessmentItemId: input.item._id,
    coreAssessmentScoreId: input.score._id,
    sourceTotalMarks: input.outcome.totalMarks,
    sourceMaximumMarks: input.outcome.maximumAvailableMarks,
    appliedScore: input.score.score,
    appliedMaximumMarks: input.score.maxScoreSnapshot,
    scaling: { method: "identity_raw_marks", sourceMaximumMarks: input.outcome.maximumAvailableMarks, targetMaximumMarks: input.score.maxScoreSnapshot, rounding: "none" },
    sourceOperationId: input.sourceOperationId,
    requestIdempotencyKey: input.requestIdempotencyKey,
    outcomeIntegrityReference: input.outcome.integrityReference,
    actorUserId: input.actor.userId,
    actorRole: "school_admin",
    entitlementKey: "assessment.premium_publication",
    status: "completed",
    failureCode: null,
    completedAt: input.now,
    failedAt: null,
  });
}

export async function handoffApprovedMarkingOutcome(input: HandoffInput) {
  assertActor(input.actor);
  const outcomeId = oid(input.approvedOutcomeId, "Approved outcome id");
  const idempotencyKey = requestKey(input.requestIdempotencyKey);
  try {
    return await transaction(async (session) => {
      await assertHandoffActor(input, session);

      const keyedReceipt = await loadCompletedReceipt({ schoolId: input.actor.schoolId, requestIdempotencyKey: idempotencyKey }, session);
      if (keyedReceipt && !same(keyedReceipt.sourceOutcomeId, outcomeId)) {
        throw new AssessmentScoreHandoffError("The idempotency key is already bound to another approved outcome", 409);
      }
      const outcomeProbe = await AssessmentApprovedMarkingOutcome.findOne({ _id: outcomeId, schoolId: input.actor.schoolId }).select("_id approvedRevisionId").session(session).lean<{ _id: Types.ObjectId; approvedRevisionId: Types.ObjectId } | null>();
      if (!outcomeProbe) throw new AssessmentScoreHandoffError("Approved marking outcome not found", 404);
      const sourceOperationId = `assess-score-handoff:${String(outcomeProbe._id)}:${String(outcomeProbe.approvedRevisionId)}`;
      const replay = keyedReceipt ?? await loadCompletedReceipt({ schoolId: input.actor.schoolId, sourceOperationId }, session);
      if (replay) return { receipt: serializeScoreHandoffReceipt(replay), replayed: true as const };

      const source = await validateSource({ outcomeId, schoolId: input.actor.schoolId, session });
      const fenced = await fenceActivePacketAssignment({
        session,
        schoolId: input.actor.schoolId,
        assignmentId: source.packetAssignment._id,
        deliveryId: source.delivery._id,
        studentId: source.student._id,
      });
      if (!fenced) throw new AssessmentScoreHandoffError("The candidate assignment changed before score handoff", 409);
      const existingTargetReceipt = await AssessmentScoreHandoffReceipt.findOne({ schoolId: input.actor.schoolId, assessmentItemId: source.item._id, studentId: source.student._id, status: "completed" }).session(session).lean<IAssessmentScoreHandoffReceipt | null>();
      if (existingTargetReceipt) throw new AssessmentScoreHandoffError("This canonical student and assessment item already have a completed handoff", 409);
      const existingScore = await AssessmentScore.findOne({ schoolId: input.actor.schoolId, assessmentItemId: source.item._id, studentId: source.student._id }).session(session).select("_id status").lean();
      if (existingScore) throw new AssessmentScoreHandoffError("A Core score already exists for this student and assessment item; no score was overwritten", 409);

      const score = await writeAssessmentScoreFromAuthorizedHandoff({
        session,
        schoolId: input.actor.schoolId,
        assessmentItemId: source.item._id,
        assessmentPlanId: source.plan._id,
        academicPeriodId: source.item.academicPeriodId,
        classGroupId: source.item.classGroupId,
        subjectId: source.item.subjectId,
        studentId: source.student._id,
        teacherId: source.item.teacherId,
        actorUserId: input.actor.userId,
        score: source.outcome.totalMarks,
        maxScore: source.targetMaximumMarks,
      });
      if (input.failureInjection === "after_core_score") throw new Error("Injected failure after Core score write");

      const now = new Date();
      const receipt = buildReceipt({ actor: input.actor, outcome: source.outcome, definition: source.definition, delivery: source.delivery, plan: source.plan, item: source.item, score, sourceOperationId, requestIdempotencyKey: idempotencyKey, now });
      const audit = await writeTransactionalAuditEvent(session, {
        actionCode: "assessment.score_handoff.completed",
        scopeType: "school",
        scopeId: String(input.actor.schoolId),
        result: "succeeded",
        target: { targetEntityType: "AssessmentScoreHandoffReceipt", targetEntityId: receipt._id, secondaryEntityType: "AssessmentScore", secondaryEntityId: score._id },
        context: buildAuditContext(input, sourceOperationId),
        payload: {
          before: { coreAssessmentScoreId: null, receiptStatus: null },
          after: { coreAssessmentScoreId: String(score._id), receiptStatus: "completed", sourceOutcomeId: String(source.outcome._id), sourceOperationId },
          changedFields: ["coreAssessmentScoreId", "receiptStatus", "auditEventId"],
          metadata: {
            approvedRevisionId: String(source.outcome.approvedRevisionId),
            assessmentDefinitionVersionId: String(source.definition._id),
            assessmentDeliveryVersionId: String(source.delivery._id),
            assessmentPlanId: String(source.plan._id),
            assessmentItemId: String(source.item._id),
            studentId: String(source.student._id),
            sourceTotalMarks: source.outcome.totalMarks,
            sourceMaximumMarks: source.outcome.maximumAvailableMarks,
            appliedScore: score.score,
            appliedMaximumMarks: score.maxScoreSnapshot,
            scalingMethod: "identity_raw_marks",
            reportCardRelease: "not_triggered",
          },
        },
        streamKey: `school:${String(input.actor.schoolId)}`,
      });
      receipt.auditEventId = audit._id;
      await receipt.save({ session });
      if (input.failureInjection === "after_receipt_save") throw new Error("Injected failure after receipt save");
      return { receipt: serializeScoreHandoffReceipt(receipt.toObject() as IAssessmentScoreHandoffReceipt), replayed: false as const };
    });
  } catch (error) {
    if (error instanceof AssessmentScoreHandoffError) throw error;
    if (error instanceof AssessmentScoreWriteConflictError) throw new AssessmentScoreHandoffError(error.message, 409);
    if (duplicate(error)) throw new AssessmentScoreHandoffError("Concurrent score handoff conflicted with an existing canonical score or receipt", 409);
    if (transactionUnavailable(error)) throw new AssessmentScoreHandoffError("Score handoff requires a MongoDB replica-set transaction; no score was written", 503);
    throw error;
  }
}

export async function getScoreHandoffStatus(input: { actor: AssessmentScoreHandoffActor; approvedOutcomeId: Types.ObjectId }) {
  assertActor(input.actor);
  const outcomeId = oid(input.approvedOutcomeId, "Approved outcome id");
  const receipt = await AssessmentScoreHandoffReceipt.findOne({ schoolId: input.actor.schoolId, sourceOutcomeId: outcomeId, status: "completed" }).lean<IAssessmentScoreHandoffReceipt | null>();
  return receipt ? serializeScoreHandoffReceipt(receipt) : null;
}
