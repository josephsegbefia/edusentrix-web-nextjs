import { randomBytes, randomUUID } from "node:crypto";
import mongoose, { Types, type ClientSession } from "mongoose";
import { AssessmentDefinitionVersion, type IAssessmentDefinitionVersion } from "@/models/AssessmentDefinitionVersion";
import { AssessmentDeliveryVersion, type IAssessmentDeliveryVersion } from "@/models/AssessmentDeliveryVersion";
import { AssessmentPaperPacket, type IAssessmentPaperPacket, type IAssessmentPaperPacketPage } from "@/models/AssessmentPaperPacket";
import { ClassGroup } from "@/models/ClassGroup";
import { ExamType } from "@/models/ExamType";
import { Grade } from "@/models/Grade";
import { School } from "@/models/School";
import { Subject } from "@/models/Subject";
import { hashAssessmentDefinition } from "@/lib/assess/assessment-definition-service";
import { buildPaperDeliveryPreviewPdf, buildPaperPacketPdf, calculatePaperPacketPageCount } from "@/lib/assess/paper-packet-pdf";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import type { AuditRequestContext } from "@/lib/audit/types";

const TRANSACTION_OPTIONS = {
  readConcern: { level: "snapshot" as const },
  writeConcern: { w: "majority" as const },
  maxCommitTimeMS: 10_000,
};

const ELIGIBLE_DELIVERY_STATUSES = new Set(["published", "active"]);

export class AssessmentPaperPacketError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 503;

  constructor(message: string, status: 400 | 403 | 404 | 409 | 503 = 409) {
    super(message);
    this.name = "AssessmentPaperPacketError";
    this.status = status;
  }
}

export type AssessmentPaperPacketActor = {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  isAdmin: boolean;
  premiumPublicationEntitled: boolean;
};

type PacketAuditInput = {
  context?: AuditRequestContext;
  idempotencyKey: string;
};

type PacketSource = {
  schoolName: string;
  subjectName: string;
  gradeName: string;
  classGroupNames: string[];
  examTypeName: string;
  definition: IAssessmentDefinitionVersion;
  delivery: IAssessmentDeliveryVersion;
};

function requiredObjectId(value: Types.ObjectId | string | null | undefined, label: string) {
  if (!value || !Types.ObjectId.isValid(String(value))) {
    throw new AssessmentPaperPacketError(`${label} is invalid`, 400);
  }
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}

function sameId(left: Types.ObjectId | string | null | undefined, right: Types.ObjectId | string | null | undefined) {
  return Boolean(left && right && String(left) === String(right));
}

function assertActor(actor: AssessmentPaperPacketActor) {
  if (!actor.isAdmin) throw new AssessmentPaperPacketError("Only school administrators can manage paper packets", 403);
  if (!actor.premiumPublicationEntitled) {
    throw new AssessmentPaperPacketError("Premium Assess publication entitlement is required", 403);
  }
}

function opaque(prefix: string) {
  return `${prefix}${randomBytes(18).toString("base64url").replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`;
}

function duplicateKey(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000);
}

function transientTransaction(error: unknown) {
  const value = error as { errorLabels?: unknown; message?: string } | null;
  const message = String(value?.message ?? "").toLowerCase();
  return Array.isArray(value?.errorLabels) &&
    (value.errorLabels.includes("TransientTransactionError") || value.errorLabels.includes("UnknownTransactionCommitResult")) ||
    message.includes("write conflict") || message.includes("temporarily unavailable");
}

async function withTransaction<T>(callback: (session: ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await session.withTransaction(() => callback(session), TRANSACTION_OPTIONS);
      } catch (error) {
        lastError = error;
        if (!transientTransaction(error) || attempt === 4) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Transaction failed");
  } finally {
    await session.endSession();
  }
}

function auditContext(actor: AssessmentPaperPacketActor, input: PacketAuditInput, suffix: string): AuditRequestContext {
  const context = input.context;
  return {
    requestId: context?.requestId || randomUUID(),
    correlationId: context?.correlationId || context?.requestId || randomUUID(),
    idempotencyKey: `${input.idempotencyKey}:${suffix}`,
    actorType: "user",
    actorId: actor.userId,
    actorRole: "school_admin",
    actorEmail: context?.actorEmail ?? null,
    actorName: context?.actorName ?? null,
    schoolId: actor.schoolId,
    ipAddress: context?.ipAddress ?? null,
    userAgent: context?.userAgent ?? null,
    routePath: context?.routePath ?? null,
    clientSurface: context?.clientSurface ?? "api",
  };
}

async function loadPacketSource(
  schoolId: Types.ObjectId,
  deliveryId: Types.ObjectId,
  session?: ClientSession
): Promise<PacketSource> {
  const deliveryQuery = AssessmentDeliveryVersion.findOne({ _id: deliveryId, schoolId });
  const delivery = await (session ? deliveryQuery.session(session) : deliveryQuery).lean();
  if (!delivery) throw new AssessmentPaperPacketError("Assessment delivery not found", 404);
  if (!ELIGIBLE_DELIVERY_STATUSES.has(delivery.status)) {
    throw new AssessmentPaperPacketError("Only published or active deliveries can generate paper packets", 409);
  }
  if (delivery.mode !== "paper") throw new AssessmentPaperPacketError("Only paper deliveries can generate paper packets", 400);

  const definitionQuery = AssessmentDefinitionVersion.findOne({
    _id: delivery.assessmentDefinitionVersionId,
    schoolId,
    status: "published",
  });
  const definition = await (session ? definitionQuery.session(session) : definitionQuery).lean();
  if (!definition) throw new AssessmentPaperPacketError("The immutable published definition is unavailable", 409);
  if (!sameId(definition.schoolId, schoolId) || definition.contentHash !== delivery.definitionContentHash) {
    throw new AssessmentPaperPacketError("Delivery and immutable definition content do not match", 409);
  }
  if (definition.resourceManifest.length > 0 || definition.sections.some((section) => section.questions.some((question) => question.attachments.length > 0))) {
    throw new AssessmentPaperPacketError("Attachment-bearing examinations require verified private resource integrity before packet generation", 409);
  }

  const [schoolQuery, subjectQuery, gradeQuery, classGroupsQuery, examTypeQuery] = [
    School.findOne({ _id: schoolId, status: "active" }).select("name"),
    Subject.findOne({ _id: definition.subjectId, schoolId }).select("name"),
    Grade.findOne({ _id: definition.gradeId, schoolId }).select("name"),
    ClassGroup.find({ _id: { $in: delivery.classGroupIds.length ? delivery.classGroupIds : definition.classGroupIds }, schoolId }).select("name").sort({ name: 1 }),
    ExamType.findOne({ _id: definition.examTypeId, schoolId }).select("name"),
  ];
  const [school, subject, grade, classGroups, examType] = await Promise.all(
    [schoolQuery, subjectQuery, gradeQuery, classGroupsQuery, examTypeQuery].map((query) => session ? query.session(session).lean() : query.lean())
  ) as [{ name?: string } | null, { name?: string } | null, { name?: string } | null, { name?: string }[], { name?: string } | null];
  if (!school) throw new AssessmentPaperPacketError("School not found or inactive", 403);

  return {
    schoolName: school.name || "School",
    subjectName: subject?.name || "Subject",
    gradeName: grade?.name || "Grade",
    classGroupNames: classGroups.flatMap((group) => group.name ? [group.name] : []),
    examTypeName: examType?.name || "Examination",
    definition: definition as IAssessmentDefinitionVersion,
    delivery: delivery as IAssessmentDeliveryVersion,
  };
}

function pageManifest(packetId: string, pageCount: number): IAssessmentPaperPacketPage[] {
  return Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const pageId = opaque("ES-PG-");
    const fallbackCode = `ES-${packetId.replace("ES-PKT-", "").slice(0, 10)}-P${String(pageNumber).padStart(2, "0")}`;
    const qrPayload = JSON.stringify({ v: 1, t: "paper-page", id: pageId });
    return { pageId, pageNumber, expectedPageCount: pageCount, fallbackCode, qrPayload };
  });
}

export function serializeAssessmentPaperPacket(packet: IAssessmentPaperPacket) {
  return {
    id: String(packet._id),
    packetId: packet.packetId,
    fallbackCode: packet.fallbackCode,
    batchId: packet.batchId,
    batchSequence: packet.batchSequence,
    batchQuantity: packet.batchQuantity,
    assessmentDefinitionVersionId: String(packet.assessmentDefinitionVersionId),
    assessmentDeliveryVersionId: String(packet.assessmentDeliveryVersionId),
    deliveryContentHash: packet.deliveryContentHash,
    status: packet.status,
    createdBy: String(packet.createdBy),
    issuedBy: String(packet.issuedBy),
    createdAt: packet.createdAt,
    issuedAt: packet.issuedAt,
    voidedBy: packet.voidedBy ? String(packet.voidedBy) : null,
    voidReason: packet.voidReason,
    voidedAt: packet.voidedAt,
    pageManifest: packet.pageManifest.map((page) => ({
      pageId: page.pageId,
      pageNumber: page.pageNumber,
      expectedPageCount: page.expectedPageCount,
      fallbackCode: page.fallbackCode,
    })),
  };
}

export async function generatePaperPacketBatch(input: {
  actor: AssessmentPaperPacketActor;
  assessmentDeliveryVersionId: Types.ObjectId;
  quantity: number;
  idempotencyKey: string;
  batchLabel?: string | null;
  auditContext?: AuditRequestContext;
}) {
  assertActor(input.actor);
  const deliveryId = requiredObjectId(input.assessmentDeliveryVersionId, "Assessment delivery id");
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) {
    throw new AssessmentPaperPacketError("Packet quantity must be an integer between 1 and 100", 400);
  }
  const idempotencyKey = input.idempotencyKey.trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 240) {
    throw new AssessmentPaperPacketError("A valid packet-generation idempotency key is required", 400);
  }
  const fingerprint = hashAssessmentDefinition({ deliveryId: String(deliveryId), quantity: input.quantity });

  try {
    const result = await withTransaction(async (session) => {
      const existing = await AssessmentPaperPacket.find({ schoolId: input.actor.schoolId, generationIdempotencyKey: idempotencyKey })
        .sort({ batchSequence: 1 })
        .session(session)
        .lean();
      if (existing.length > 0) {
        if (existing.some((packet) => packet.batchFingerprint !== fingerprint || packet.batchQuantity !== input.quantity)) {
          throw new AssessmentPaperPacketError("The idempotency key was already used for a different packet batch", 409);
        }
        return { packets: existing as IAssessmentPaperPacket[], replayed: true };
      }

      const source = await loadPacketSource(input.actor.schoolId, deliveryId, session);
      const pageCount = await calculatePaperPacketPageCount(source);
      if (pageCount < 1) throw new AssessmentPaperPacketError("The immutable examination produced no PDF pages", 409);
      const batchId = opaque("ES-BATCH-");
      const packets = Array.from({ length: input.quantity }, (_, index) => {
        const packetId = opaque("ES-PKT-");
        const now = new Date();
        return new AssessmentPaperPacket({
          schoolId: input.actor.schoolId,
          assessmentDefinitionVersionId: source.definition._id,
          assessmentDeliveryVersionId: source.delivery._id,
          deliveryContentHash: source.delivery.contentHash,
          packetId,
          fallbackCode: `ES-${packetId.replace("ES-PKT-", "").slice(0, 12)}`,
          batchId,
          batchSequence: index + 1,
          batchQuantity: input.quantity,
          generationIdempotencyKey: idempotencyKey,
          isBatchLeader: index === 0,
          batchFingerprint: fingerprint,
          status: "issued",
          pageManifest: pageManifest(packetId, pageCount),
          createdBy: input.actor.userId,
          issuedBy: input.actor.userId,
          voidedBy: null,
          voidReason: null,
          createdAt: now,
          issuedAt: now,
          voidedAt: null,
        });
      });
      // Preflight the exact candidate-safe renderer before persisting any issued
      // identity. A rendering failure must abort the transaction, so retrying
      // does not leave an issued packet that cannot be rendered.
      const preflight = packets[0].toObject() as IAssessmentPaperPacket;
      await buildPaperPacketPdf({
        ...source,
        packet: {
          packetId: preflight.packetId,
          fallbackCode: preflight.fallbackCode,
          pageManifest: preflight.pageManifest,
        },
      });
      const created = await AssessmentPaperPacket.insertMany(packets, { session, ordered: true });
      for (const packet of created) {
        await writeTransactionalAuditEvent(session, {
          actionCode: "assessment.paper_packet.generated",
          scopeType: "school",
          scopeId: String(input.actor.schoolId),
          result: "succeeded",
          target: { targetEntityType: "AssessmentPaperPacket", targetEntityId: packet._id },
          context: auditContext(input.actor, { context: input.auditContext, idempotencyKey }, `generated:${packet.packetId}`),
          payload: {
            metadata: {
              packetId: packet.packetId,
              batchId: packet.batchId,
              batchSequence: packet.batchSequence,
              quantity: input.quantity,
              assessmentDeliveryVersionId: String(packet.assessmentDeliveryVersionId),
              batchLabel: input.batchLabel?.trim() || null,
            },
          },
          streamKey: `school:${String(input.actor.schoolId)}`,
        });
      }
      return { packets: created as IAssessmentPaperPacket[], replayed: false };
    });
    return { ...result, batchId: result.packets[0]?.batchId ?? null };
  } catch (error) {
    if (duplicateKey(error)) {
      const existing = await AssessmentPaperPacket.find({ schoolId: input.actor.schoolId, generationIdempotencyKey: idempotencyKey })
        .sort({ batchSequence: 1 })
        .lean();
      if (existing.length > 0 && existing.every((packet) => packet.batchFingerprint === fingerprint && packet.batchQuantity === input.quantity)) {
        return { packets: existing as IAssessmentPaperPacket[], batchId: existing[0]?.batchId ?? null, replayed: true };
      }
    }
    throw error;
  }
}

export async function listAssessmentPaperPackets(input: {
  actor: AssessmentPaperPacketActor;
  assessmentDeliveryVersionId?: Types.ObjectId | null;
}) {
  assertActor(input.actor);
  const filter: Record<string, unknown> = { schoolId: input.actor.schoolId };
  if (input.assessmentDeliveryVersionId) filter.assessmentDeliveryVersionId = requiredObjectId(input.assessmentDeliveryVersionId, "Assessment delivery id");
  const packets = await AssessmentPaperPacket.find(filter).sort({ createdAt: -1, batchSequence: 1 }).limit(500).lean();
  const batchMap = new Map<string, IAssessmentPaperPacket[]>();
  for (const packet of packets) batchMap.set(packet.batchId, [...(batchMap.get(packet.batchId) ?? []), packet as IAssessmentPaperPacket]);
  return {
    packets: packets.map((packet) => serializeAssessmentPaperPacket(packet as IAssessmentPaperPacket)),
    batches: [...batchMap.entries()].map(([batchId, rows]) => ({
      batchId,
      quantity: rows[0]?.batchQuantity ?? rows.length,
      deliveryId: rows[0] ? String(rows[0].assessmentDeliveryVersionId) : null,
      createdAt: rows[rows.length - 1]?.createdAt ?? null,
      issuedCount: rows.filter((row) => row.status === "issued").length,
      voidedCount: rows.filter((row) => row.status === "voided").length,
      packetIds: rows.map((row) => row.packetId),
    })),
  };
}

export async function getAssessmentPaperPacket(input: { actor: AssessmentPaperPacketActor; packetId: string }) {
  assertActor(input.actor);
  const packet = await AssessmentPaperPacket.findOne({ schoolId: input.actor.schoolId, packetId: input.packetId.trim() }).lean();
  return packet ? (packet as IAssessmentPaperPacket) : null;
}

export async function renderAssessmentDeliveryPreview(input: {
  actor: AssessmentPaperPacketActor;
  assessmentDeliveryVersionId: Types.ObjectId;
}) {
  assertActor(input.actor);
  const source = await loadPacketSource(input.actor.schoolId, requiredObjectId(input.assessmentDeliveryVersionId, "Assessment delivery id"));
  return buildPaperDeliveryPreviewPdf(source);
}

export async function voidAssessmentPaperPacket(input: {
  actor: AssessmentPaperPacketActor;
  packetId: string;
  reason: string;
  idempotencyKey: string;
  auditContext?: AuditRequestContext;
}) {
  assertActor(input.actor);
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 1000) throw new AssessmentPaperPacketError("A void reason is required", 400);
  return withTransaction(async (session) => {
    const packet = await AssessmentPaperPacket.findOne({ schoolId: input.actor.schoolId, packetId: input.packetId.trim() }).session(session);
    if (!packet) throw new AssessmentPaperPacketError("Paper packet not found", 404);
    if (packet.status === "voided") return { packet: packet.toObject() as IAssessmentPaperPacket, replayed: true };
    if (packet.status !== "issued") throw new AssessmentPaperPacketError("Only issued paper packets can be voided", 409);
    const before = { status: packet.status, packetId: packet.packetId };
    packet.status = "voided";
    packet.voidedAt = new Date();
    packet.voidedBy = input.actor.userId;
    packet.voidReason = reason;
    await packet.save({ session });
    await writeTransactionalAuditEvent(session, {
      actionCode: "assessment.paper_packet.voided",
      scopeType: "school",
      scopeId: String(input.actor.schoolId),
      result: "succeeded",
      target: { targetEntityType: "AssessmentPaperPacket", targetEntityId: packet._id },
      context: auditContext(input.actor, { context: input.auditContext, idempotencyKey: input.idempotencyKey }, `voided:${packet.packetId}`),
      reason: { reasonCode: "operator_void", reason },
      payload: { before, after: { status: packet.status, packetId: packet.packetId }, changedFields: ["status", "voidedAt", "voidedBy", "voidReason"] },
      streamKey: `school:${String(input.actor.schoolId)}`,
    });
    return { packet: packet.toObject() as IAssessmentPaperPacket, replayed: false };
  });
}

export async function renderAssessmentPaperPacket(input: {
  actor: AssessmentPaperPacketActor;
  packetId: string;
  mode: "download" | "reprint";
  idempotencyKey: string;
  auditContext?: AuditRequestContext;
}) {
  assertActor(input.actor);
  const packet = await AssessmentPaperPacket.findOne({ schoolId: input.actor.schoolId, packetId: input.packetId.trim() }).lean();
  if (!packet) throw new AssessmentPaperPacketError("Paper packet not found", 404);
  if (packet.status !== "issued") throw new AssessmentPaperPacketError("Voided paper packets cannot be downloaded or reprinted", 409);
  const source = await loadPacketSource(input.actor.schoolId, packet.assessmentDeliveryVersionId);
  const pdf = await buildPaperPacketPdf({ ...source, packet: packet as IAssessmentPaperPacket });
  await withTransaction(async (session) => {
    const current = await AssessmentPaperPacket.findOne({ schoolId: input.actor.schoolId, packetId: packet.packetId }).session(session).lean();
    if (!current || current.status !== "issued") throw new AssessmentPaperPacketError("Paper packet is no longer eligible for download", 409);
    await writeTransactionalAuditEvent(session, {
      actionCode: input.mode === "reprint" ? "assessment.paper_packet.reprinted" : "assessment.paper_packet.downloaded",
      scopeType: "school",
      scopeId: String(input.actor.schoolId),
      result: "succeeded",
      target: { targetEntityType: "AssessmentPaperPacket", targetEntityId: current._id },
      context: auditContext(input.actor, { context: input.auditContext, idempotencyKey: input.idempotencyKey }, `${input.mode}:${current.packetId}`),
      payload: { metadata: { packetId: current.packetId, batchId: current.batchId, pageCount: current.pageManifest.length } },
      streamKey: `school:${String(input.actor.schoolId)}`,
    });
  });
  return { bytes: pdf.bytes, fileName: `${packet.packetId.toLowerCase()}.pdf`, pageCount: pdf.pageCount };
}
