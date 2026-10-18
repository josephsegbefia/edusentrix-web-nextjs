import { randomUUID } from "node:crypto";
import mongoose, { Types, type ClientSession } from "mongoose";
import { AssessmentDeliveryVersion, type IAssessmentDeliveryVersion } from "@/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket, type IAssessmentPaperPacket } from "@/models/AssessmentPaperPacket";
import { AssessmentPaperPacketAssignment, type IAssessmentPaperPacketAssignment } from "@/models/AssessmentPaperPacketAssignment";
import { AssessmentPaperPacketCorrection, type IAssessmentPaperPacketCorrection } from "@/models/AssessmentPaperPacketCorrection";
import { AssessmentApprovedMarkingOutcome } from "@/models/AssessmentApprovedMarkingOutcome";
import { AcademicPeriod, type IAcademicPeriod } from "@/models/AcademicPeriod";
import { Student, type IStudent } from "@/models/Student";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import type { AuditRequestContext } from "@/lib/audit/types";

const TRANSACTION_OPTIONS = { readConcern: { level: "snapshot" as const }, writeConcern: { w: "majority" as const }, maxCommitTimeMS: 10_000 };
const DELIVERY_STATUSES = new Set(["published", "active"]);

export class AssessmentPaperAssignmentError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 503;
  constructor(message: string, status: 400 | 403 | 404 | 409 | 503 = 409) { super(message); this.name = "AssessmentPaperAssignmentError"; this.status = status; }
}

export type AssessmentPaperAssignmentActor = { userId: Types.ObjectId; schoolId: Types.ObjectId; isAdmin: boolean; premiumPublicationEntitled: boolean };
type AuditInput = { context?: AuditRequestContext; idempotencyKey: string };

function oid(value: string | Types.ObjectId | null | undefined, label: string) {
  if (!value || !Types.ObjectId.isValid(String(value))) throw new AssessmentPaperAssignmentError(`${label} is invalid`, 400);
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}
function same(a: unknown, b: unknown) { return String(a) === String(b); }
function duplicate(error: unknown) { return Boolean(error && typeof error === "object" && (error as { code?: number }).code === 11000); }
function transient(error: unknown) { const e = error as { errorLabels?: unknown; message?: string }; const m = String(e?.message ?? "").toLowerCase(); return Array.isArray(e?.errorLabels) && (e.errorLabels.includes("TransientTransactionError") || e.errorLabels.includes("UnknownTransactionCommitResult")) || m.includes("write conflict") || m.includes("temporarily unavailable"); }
async function transaction<T>(fn: (session: ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let last: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { return await session.withTransaction(() => fn(session), TRANSACTION_OPTIONS); }
      catch (error) { last = error; if (!transient(error) || attempt === 4) throw error; }
    }
    throw last instanceof Error ? last : new Error("Assessment assignment transaction failed");
  } finally { await session.endSession(); }
}
function assertActor(actor: AssessmentPaperAssignmentActor) {
  if (!actor.isAdmin) throw new AssessmentPaperAssignmentError("Only school administrators can manage candidate assignments", 403);
  if (!actor.premiumPublicationEntitled) throw new AssessmentPaperAssignmentError("Premium Assess publication entitlement is required", 403);
}
function context(actor: AssessmentPaperAssignmentActor, input: AuditInput, suffix: string): AuditRequestContext {
  return { requestId: input.context?.requestId || randomUUID(), correlationId: input.context?.correlationId || input.context?.requestId || randomUUID(), idempotencyKey: `${input.idempotencyKey}:${suffix}`, actorType: "user", actorId: actor.userId, actorRole: "school_admin", actorEmail: input.context?.actorEmail ?? null, actorName: input.context?.actorName ?? null, schoolId: actor.schoolId, ipAddress: input.context?.ipAddress ?? null, userAgent: input.context?.userAgent ?? null, routePath: input.context?.routePath ?? null, clientSurface: input.context?.clientSurface ?? "api" };
}
function studentProjection(student: Pick<IStudent, "_id" | "firstName" | "middleName" | "lastName" | "admissionNo" | "gradeId" | "classGroupId" | "status" | "enrolledAt">) {
  return { id: String(student._id), firstName: student.firstName, middleName: student.middleName ?? null, lastName: student.lastName, admissionNo: student.admissionNo ?? null, gradeId: String(student.gradeId), classGroupId: String(student.classGroupId), status: student.status, enrolledAt: student.enrolledAt ?? null };
}
function serializeAssignment(row: IAssessmentPaperPacketAssignment) {
  return { id: String(row._id), schoolId: String(row.schoolId), deliveryId: String(row.assessmentDeliveryVersionId), packetId: String(row.assessmentPaperPacketId), studentId: String(row.studentId), academicPeriodId: String(row.academicPeriodId), gradeId: String(row.gradeId), classGroupId: String(row.classGroupId), status: row.status, assignedBy: String(row.assignedBy), assignedAt: row.assignedAt, replacedByCorrectionId: row.replacedByCorrectionId ? String(row.replacedByCorrectionId) : null, replacedAt: row.replacedAt ?? null };
}
function serializeCorrection(row: IAssessmentPaperPacketCorrection) {
  return { id: String(row._id), assignmentId: String(row.assignmentId), packetId: String(row.assessmentPaperPacketId), deliveryId: String(row.assessmentDeliveryVersionId), originalStudentId: String(row.originalStudentId), proposedStudentId: String(row.proposedStudentId), reason: row.reason, status: row.status, requestedBy: String(row.requestedBy), requestedAt: row.requestedAt, reviewedBy: row.reviewedBy ? String(row.reviewedBy) : null, reviewedAt: row.reviewedAt ?? null, decisionReason: row.decisionReason ?? null, resultingAssignmentId: row.resultingAssignmentId ? String(row.resultingAssignmentId) : null };
}

async function loadDeliveryAndPeriod(schoolId: Types.ObjectId, deliveryId: Types.ObjectId, session?: ClientSession) {
  const deliveryQuery = AssessmentDeliveryVersion.findOne({ _id: deliveryId, schoolId });
  const delivery = await (session ? deliveryQuery.session(session) : deliveryQuery).lean<IAssessmentDeliveryVersion | null>();
  if (!delivery) throw new AssessmentPaperAssignmentError("Assessment delivery not found", 404);
  if (!DELIVERY_STATUSES.has(delivery.status) || delivery.mode !== "paper") throw new AssessmentPaperAssignmentError("Only published or active paper deliveries can receive packet assignments", 409);
  const periodQuery = AcademicPeriod.findOne({ _id: delivery.academicPeriodId, schoolId });
  const period = await (session ? periodQuery.session(session) : periodQuery).lean<IAcademicPeriod | null>();
  if (!period) throw new AssessmentPaperAssignmentError("The delivery academic period is unavailable", 409);
  return { delivery, period };
}

async function eligibleStudent(input: { schoolId: Types.ObjectId; delivery: IAssessmentDeliveryVersion; period: IAcademicPeriod; studentId: Types.ObjectId; session?: ClientSession }) {
  const query = Student.findOne({ _id: input.studentId, schoolId: input.schoolId, status: "active", gradeId: input.delivery.gradeId, classGroupId: { $in: input.delivery.classGroupIds }, enrolledAt: { $ne: null, $lte: input.delivery.schedule.scheduledDate ?? input.period.endDate } }).select("_id schoolId firstName middleName lastName admissionNo gradeId classGroupId status enrolledAt");
  const student = await (input.session ? query.session(input.session) : query).lean<Pick<IStudent, "_id" | "schoolId" | "firstName" | "middleName" | "lastName" | "admissionNo" | "gradeId" | "classGroupId" | "status" | "enrolledAt"> | null>();
  if (!student) throw new AssessmentPaperAssignmentError("Student is not eligible for this delivery's school, academic period, grade or class scope", 409);
  return student;
}

export async function listEligibleAssessmentCandidates(input: { actor: AssessmentPaperAssignmentActor; assessmentDeliveryVersionId: Types.ObjectId; search?: string | null }) {
  assertActor(input.actor);
  const deliveryId = oid(input.assessmentDeliveryVersionId, "Assessment delivery id");
  const { delivery, period } = await loadDeliveryAndPeriod(input.actor.schoolId, deliveryId);
  const q = input.search?.trim();
  const search: Record<string, unknown> = q ? { $or: [{ firstName: { $regex: q, $options: "i" } }, { lastName: { $regex: q, $options: "i" } }, { admissionNo: { $regex: q, $options: "i" } }] } : {};
  const students = await Student.find({ schoolId: input.actor.schoolId, status: "active", gradeId: delivery.gradeId, classGroupId: { $in: delivery.classGroupIds }, enrolledAt: { $ne: null, $lte: delivery.schedule.scheduledDate ?? period.endDate }, ...search }).select("_id firstName middleName lastName admissionNo gradeId classGroupId status enrolledAt").sort({ lastName: 1, firstName: 1 }).limit(100).lean();
  return { deliveryId: String(delivery._id), candidates: students.map(studentProjection) };
}

export async function listAssessmentPacketAssignments(input: { actor: AssessmentPaperAssignmentActor; assessmentDeliveryVersionId: Types.ObjectId; packetId?: Types.ObjectId | null; studentId?: Types.ObjectId | null }) {
  assertActor(input.actor);
  const deliveryId = oid(input.assessmentDeliveryVersionId, "Assessment delivery id");
  await loadDeliveryAndPeriod(input.actor.schoolId, deliveryId);
  const filter: Record<string, unknown> = { schoolId: input.actor.schoolId, assessmentDeliveryVersionId: deliveryId };
  if (input.packetId) filter.assessmentPaperPacketId = oid(input.packetId, "Packet id");
  if (input.studentId) filter.studentId = oid(input.studentId, "Student id");
  const [assignments, corrections] = await Promise.all([
    AssessmentPaperPacketAssignment.find(filter).sort({ assignedAt: -1 }).lean(),
    AssessmentPaperPacketCorrection.find({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: deliveryId }).sort({ requestedAt: -1 }).limit(500).lean(),
  ]);
  return { assignments: assignments.map((row) => serializeAssignment(row as IAssessmentPaperPacketAssignment)), corrections: corrections.map((row) => serializeCorrection(row as IAssessmentPaperPacketCorrection)) };
}

export async function assignAssessmentPaperPacket(input: { actor: AssessmentPaperAssignmentActor; assessmentPaperPacketId: Types.ObjectId; studentId: Types.ObjectId; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertActor(input.actor);
  const packetId = oid(input.assessmentPaperPacketId, "Paper packet id");
  const studentId = oid(input.studentId, "Student id");
  const key = input.idempotencyKey.trim();
  if (key.length < 8 || key.length > 240) throw new AssessmentPaperAssignmentError("A valid assignment idempotency key is required", 400);
  try {
    return await transaction(async (session) => {
      const previous = await AssessmentPaperPacketAssignment.findOne({ schoolId: input.actor.schoolId, assignmentIdempotencyKey: key }).session(session).lean();
      if (previous) {
        if (!same(previous.assessmentPaperPacketId, packetId) || !same(previous.studentId, studentId)) throw new AssessmentPaperAssignmentError("The idempotency key was already used for a different assignment", 409);
        return { assignment: serializeAssignment(previous as IAssessmentPaperPacketAssignment), replayed: true };
      }
      const packet = await AssessmentPaperPacket.findOne({ _id: packetId, schoolId: input.actor.schoolId }).session(session).lean<IAssessmentPaperPacket | null>();
      if (!packet) throw new AssessmentPaperAssignmentError("Paper packet not found", 404);
      if (packet.status !== "issued") throw new AssessmentPaperAssignmentError("Voided paper packets cannot be assigned", 409);
      const { delivery, period } = await loadDeliveryAndPeriod(input.actor.schoolId, packet.assessmentDeliveryVersionId, session);
      const student = await eligibleStudent({ schoolId: input.actor.schoolId, delivery, period, studentId, session });
      const existingPacket = await AssessmentPaperPacketAssignment.findOne({ schoolId: input.actor.schoolId, assessmentPaperPacketId: packet._id, status: "active" }).session(session).lean();
      if (existingPacket) throw new AssessmentPaperAssignmentError("This paper packet is already assigned", 409);
      const existingStudent = await AssessmentPaperPacketAssignment.findOne({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: delivery._id, studentId, status: "active" }).session(session).lean();
      if (existingStudent) throw new AssessmentPaperAssignmentError("This student already has an active packet assignment for this delivery", 409);
      const assignment = new AssessmentPaperPacketAssignment({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: delivery._id, assessmentPaperPacketId: packet._id, studentId: student._id, academicPeriodId: delivery.academicPeriodId, gradeId: student.gradeId, classGroupId: student.classGroupId, status: "active", assignmentIdempotencyKey: key, assignedBy: input.actor.userId, assignedAt: new Date(), replacedByCorrectionId: null, replacedAt: null });
      await assignment.save({ session });
      await writeTransactionalAuditEvent(session, { actionCode: "assessment.paper_assignment.assigned", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentPaperPacketAssignment", targetEntityId: assignment._id, secondaryEntityType: "AssessmentPaperPacket", secondaryEntityId: packet._id }, context: context(input.actor, { context: input.auditContext, idempotencyKey: key }, `assigned:${assignment._id}`), payload: { metadata: { packetId: packet.packetId, studentId: String(student._id), assessmentDeliveryVersionId: String(delivery._id), academicPeriodId: String(delivery.academicPeriodId), gradeId: String(student.gradeId), classGroupId: String(student.classGroupId) } }, streamKey: `school:${String(input.actor.schoolId)}` });
      return { assignment: serializeAssignment(assignment.toObject() as IAssessmentPaperPacketAssignment), replayed: false };
    });
  } catch (error) {
    if (duplicate(error)) throw new AssessmentPaperAssignmentError("Concurrent assignment conflicted with another active packet or student assignment", 409);
    throw error;
  }
}

export async function requestAssessmentPacketCorrection(input: { actor: AssessmentPaperAssignmentActor; assignmentId: Types.ObjectId; proposedStudentId: Types.ObjectId; reason: string; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertActor(input.actor);
  const assignmentId = oid(input.assignmentId, "Assignment id");
  const proposedStudentId = oid(input.proposedStudentId, "Proposed student id");
  const reason = input.reason.trim();
  const key = input.idempotencyKey.trim();
  if (reason.length < 3 || reason.length > 2000) throw new AssessmentPaperAssignmentError("A correction reason is required", 400);
  if (key.length < 8 || key.length > 240) throw new AssessmentPaperAssignmentError("A valid correction idempotency key is required", 400);
  try {
    return await transaction(async (session) => {
      const previous = await AssessmentPaperPacketCorrection.findOne({ schoolId: input.actor.schoolId, correctionIdempotencyKey: key }).session(session).lean();
      if (previous) return { correction: serializeCorrection(previous as IAssessmentPaperPacketCorrection), replayed: true };
    const assignment = await AssessmentPaperPacketAssignment.findOne({ _id: assignmentId, schoolId: input.actor.schoolId }).session(session).lean<IAssessmentPaperPacketAssignment | null>();
    if (!assignment) throw new AssessmentPaperAssignmentError("Packet assignment not found", 404);
    if (assignment.status !== "active") throw new AssessmentPaperAssignmentError("Only active assignments can be corrected", 409);
    const approvedOutcome = await AssessmentApprovedMarkingOutcome.findOne({ schoolId: input.actor.schoolId, packetAssignmentId: assignment._id, status: "current" }).session(session).select("_id").lean();
    if (approvedOutcome) throw new AssessmentPaperAssignmentError("Candidate identity correction is not available after an approved marking outcome; use an authorized academic correction process", 409);
    if (same(assignment.studentId, proposedStudentId)) throw new AssessmentPaperAssignmentError("The proposed student is already assigned", 409);
      const { delivery, period } = await loadDeliveryAndPeriod(input.actor.schoolId, assignment.assessmentDeliveryVersionId, session);
      const proposed = await eligibleStudent({ schoolId: input.actor.schoolId, delivery, period, studentId: proposedStudentId, session });
      const pending = await AssessmentPaperPacketCorrection.findOne({ schoolId: input.actor.schoolId, assignmentId, status: "pending" }).session(session).lean();
      if (pending) throw new AssessmentPaperAssignmentError("A correction request is already pending for this assignment", 409);
      const correction = new AssessmentPaperPacketCorrection({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: delivery._id, assessmentPaperPacketId: assignment.assessmentPaperPacketId, assignmentId, originalStudentId: assignment.studentId, proposedStudentId: proposed._id, reason, status: "pending", correctionIdempotencyKey: key, requestedBy: input.actor.userId, requestedAt: new Date(), reviewedBy: null, reviewedAt: null, decisionReason: null, resultingAssignmentId: null });
      await correction.save({ session });
      await writeTransactionalAuditEvent(session, { actionCode: "assessment.paper_assignment.correction_requested", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentPaperPacketCorrection", targetEntityId: correction._id, secondaryEntityType: "AssessmentPaperPacketAssignment", secondaryEntityId: assignment._id }, context: context(input.actor, { context: input.auditContext, idempotencyKey: key }, `correction-requested:${correction._id}`), reason: { reasonCode: "identity_correction", reason }, payload: { before: { studentId: String(assignment.studentId), status: assignment.status }, after: { proposedStudentId: String(proposed._id), status: correction.status }, changedFields: ["proposedStudentId", "status"] }, streamKey: `school:${String(input.actor.schoolId)}` });
      return { correction: serializeCorrection(correction.toObject() as IAssessmentPaperPacketCorrection), replayed: false };
    });
  } catch (error) { if (duplicate(error)) throw new AssessmentPaperAssignmentError("A correction request is already pending or the idempotency key is in use", 409); throw error; }
}

export async function reviewAssessmentPacketCorrection(input: { actor: AssessmentPaperAssignmentActor; correctionId: Types.ObjectId; decision: "approve" | "reject"; decisionReason: string; idempotencyKey: string; auditContext?: AuditRequestContext }) {
  assertActor(input.actor);
  const correctionId = oid(input.correctionId, "Correction id");
  const decisionReason = input.decisionReason.trim();
  const key = input.idempotencyKey.trim();
  if (decisionReason.length < 3 || decisionReason.length > 2000) throw new AssessmentPaperAssignmentError("A decision rationale is required", 400);
  if (key.length < 8 || key.length > 240) throw new AssessmentPaperAssignmentError("A valid review idempotency key is required", 400);
  return transaction(async (session) => {
    const correction = await AssessmentPaperPacketCorrection.findOne({ _id: correctionId, schoolId: input.actor.schoolId }).session(session);
    if (!correction) throw new AssessmentPaperAssignmentError("Correction request not found", 404);
    if (correction.status !== "pending") {
      if (correction.reviewedBy && same(correction.reviewedBy, input.actor.userId) && ((input.decision === "approve" && correction.status === "approved") || (input.decision === "reject" && correction.status === "rejected"))) return { correction: serializeCorrection(correction.toObject() as IAssessmentPaperPacketCorrection), replayed: true };
      throw new AssessmentPaperAssignmentError("Correction request has already been decided", 409);
    }
    if (same(correction.requestedBy, input.actor.userId)) throw new AssessmentPaperAssignmentError("The requesting officer cannot approve their own correction", 403);
    const assignment = await AssessmentPaperPacketAssignment.findOne({ _id: correction.assignmentId, schoolId: input.actor.schoolId }).session(session);
    if (!assignment || assignment.status !== "active" || !same(assignment.studentId, correction.originalStudentId)) throw new AssessmentPaperAssignmentError("Correction request is stale because the assignment has changed", 409);
    const approvedOutcome = await AssessmentApprovedMarkingOutcome.findOne({ schoolId: input.actor.schoolId, packetAssignmentId: assignment._id, status: "current" }).session(session).select("_id").lean();
    if (approvedOutcome) throw new AssessmentPaperAssignmentError("Candidate identity correction is not available after an approved marking outcome; use an authorized academic correction process", 409);
    const packet = await AssessmentPaperPacket.findOne({ _id: correction.assessmentPaperPacketId, schoolId: input.actor.schoolId }).session(session).lean<IAssessmentPaperPacket | null>();
    if (!packet || packet.status !== "issued") throw new AssessmentPaperAssignmentError("Correction request is stale because the packet is no longer issued", 409);
    const { delivery, period } = await loadDeliveryAndPeriod(input.actor.schoolId, correction.assessmentDeliveryVersionId, session);
    const proposed = await eligibleStudent({ schoolId: input.actor.schoolId, delivery, period, studentId: correction.proposedStudentId, session });
    if (input.decision === "reject") {
      correction.status = "rejected"; correction.reviewedBy = input.actor.userId; correction.reviewedAt = new Date(); correction.decisionReason = decisionReason; await correction.save({ session });
      await writeTransactionalAuditEvent(session, { actionCode: "assessment.paper_assignment.correction_decided", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentPaperPacketCorrection", targetEntityId: correction._id }, context: context(input.actor, { context: input.auditContext, idempotencyKey: key }, `correction-rejected:${correction._id}`), reason: { reasonCode: "correction_rejected", reason: decisionReason }, approval: { reviewedById: input.actor.userId, reviewedByRole: "school_admin" }, payload: { before: { status: "pending", studentId: String(correction.originalStudentId) }, after: { status: "rejected", proposedStudentId: String(proposed._id) }, changedFields: ["status", "reviewedBy", "reviewedAt", "decisionReason"] }, streamKey: `school:${String(input.actor.schoolId)}` });
      return { correction: serializeCorrection(correction.toObject() as IAssessmentPaperPacketCorrection), replayed: false };
    }
    const conflicting = await AssessmentPaperPacketAssignment.findOne({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: delivery._id, studentId: proposed._id, status: "active" }).session(session).lean();
    if (conflicting) throw new AssessmentPaperAssignmentError("The proposed student already has an active packet assignment for this delivery", 409);
    assignment.status = "replaced"; assignment.replacedAt = new Date(); assignment.replacedByCorrectionId = correction._id; await assignment.save({ session });
    const replacement = new AssessmentPaperPacketAssignment({ schoolId: input.actor.schoolId, assessmentDeliveryVersionId: delivery._id, assessmentPaperPacketId: assignment.assessmentPaperPacketId, studentId: proposed._id, academicPeriodId: delivery.academicPeriodId, gradeId: proposed.gradeId, classGroupId: proposed.classGroupId, status: "active", assignmentIdempotencyKey: `correction:${correction._id}`, assignedBy: input.actor.userId, assignedAt: new Date(), replacedByCorrectionId: null, replacedAt: null });
    await replacement.save({ session });
    correction.status = "approved"; correction.reviewedBy = input.actor.userId; correction.reviewedAt = new Date(); correction.decisionReason = decisionReason; correction.resultingAssignmentId = replacement._id; await correction.save({ session });
    await writeTransactionalAuditEvent(session, { actionCode: "assessment.paper_assignment.correction_decided", scopeType: "school", scopeId: String(input.actor.schoolId), result: "succeeded", target: { targetEntityType: "AssessmentPaperPacketCorrection", targetEntityId: correction._id, secondaryEntityType: "AssessmentPaperPacketAssignment", secondaryEntityId: replacement._id }, context: context(input.actor, { context: input.auditContext, idempotencyKey: key }, `correction-approved:${correction._id}`), reason: { reasonCode: "correction_approved", reason: decisionReason }, approval: { reviewedById: input.actor.userId, reviewedByRole: "school_admin" }, payload: { before: { status: "pending", studentId: String(assignment.studentId) }, after: { status: "approved", studentId: String(replacement.studentId), previousAssignmentId: String(assignment._id) }, changedFields: ["status", "reviewedBy", "reviewedAt", "decisionReason", "resultingAssignmentId"] }, streamKey: `school:${String(input.actor.schoolId)}` });
    return { correction: serializeCorrection(correction.toObject() as IAssessmentPaperPacketCorrection), assignment: serializeAssignment(replacement.toObject() as IAssessmentPaperPacketAssignment), replayed: false };
  });
}

export async function getAssessmentPacketAssignment(input: { actor: AssessmentPaperAssignmentActor; assignmentId: Types.ObjectId }) {
  assertActor(input.actor);
  const assignmentId = oid(input.assignmentId, "Assignment id");
  const assignment = await AssessmentPaperPacketAssignment.findOne({ _id: assignmentId, schoolId: input.actor.schoolId }).lean<IAssessmentPaperPacketAssignment | null>();
  if (!assignment) return null;
  const history = await AssessmentPaperPacketCorrection.find({ schoolId: input.actor.schoolId, assignmentId }).sort({ requestedAt: -1 }).lean();
  return { assignment: serializeAssignment(assignment), corrections: history.map((row) => serializeCorrection(row as IAssessmentPaperPacketCorrection)) };
}
