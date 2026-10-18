import { Schema, model, models, type Model, type Types } from "mongoose";

export const ASSESSMENT_PAPER_PACKET_STATUSES = ["issued", "voided"] as const;
export type AssessmentPaperPacketStatus = (typeof ASSESSMENT_PAPER_PACKET_STATUSES)[number];

export interface IAssessmentPaperPacketPage {
  pageId: string;
  pageNumber: number;
  expectedPageCount: number;
  fallbackCode: string;
  qrPayload: string;
}

export interface IAssessmentPaperPacket {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  assessmentDefinitionVersionId: Types.ObjectId;
  assessmentDeliveryVersionId: Types.ObjectId;
  deliveryContentHash: string;
  packetId: string;
  fallbackCode: string;
  batchId: string;
  batchSequence: number;
  batchQuantity: number;
  generationIdempotencyKey: string;
  isBatchLeader: boolean;
  batchFingerprint: string;
  status: AssessmentPaperPacketStatus;
  pageManifest: IAssessmentPaperPacketPage[];
  createdBy: Types.ObjectId;
  issuedBy: Types.ObjectId;
  voidedBy: Types.ObjectId | null;
  voidReason: string | null;
  createdAt: Date;
  issuedAt: Date;
  voidedAt: Date | null;
  updatedAt: Date;
}

const pageSchema = new Schema<IAssessmentPaperPacketPage>(
  {
    pageId: { type: String, required: true, trim: true, maxlength: 160 },
    pageNumber: { type: Number, required: true, min: 1 },
    expectedPageCount: { type: Number, required: true, min: 1 },
    fallbackCode: { type: String, required: true, trim: true, maxlength: 80 },
    qrPayload: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const packetSchema = new Schema<IAssessmentPaperPacket>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    assessmentDefinitionVersionId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentDefinitionVersion",
      required: true,
      index: true,
    },
    assessmentDeliveryVersionId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentDeliveryVersion",
      required: true,
      index: true,
    },
    deliveryContentHash: { type: String, required: true, length: 64 },
    packetId: { type: String, required: true, trim: true, maxlength: 160 },
    fallbackCode: { type: String, required: true, trim: true, maxlength: 80 },
    batchId: { type: String, required: true, trim: true, maxlength: 160 },
    batchSequence: { type: Number, required: true, min: 1 },
    batchQuantity: { type: Number, required: true, min: 1, max: 100 },
    generationIdempotencyKey: { type: String, required: true, trim: true, maxlength: 240 },
    isBatchLeader: { type: Boolean, required: true, default: false },
    batchFingerprint: { type: String, required: true, length: 64 },
    status: {
      type: String,
      enum: [...ASSESSMENT_PAPER_PACKET_STATUSES],
      required: true,
      default: "issued",
      index: true,
    },
    pageManifest: { type: [pageSchema], required: true, minlength: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    voidReason: { type: String, trim: true, maxlength: 1000, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() },
    issuedAt: { type: Date, required: true, default: () => new Date() },
    voidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

packetSchema.index({ schoolId: 1, packetId: 1 }, { unique: true, name: "assess_packet_identity_unique" });
packetSchema.index({ schoolId: 1, fallbackCode: 1 }, { unique: true, name: "assess_packet_fallback_unique" });
packetSchema.index({ schoolId: 1, batchId: 1, batchSequence: 1 }, { unique: true, name: "assess_packet_batch_sequence_unique" });
packetSchema.index(
  { schoolId: 1, generationIdempotencyKey: 1 },
  { unique: true, name: "assess_packet_generation_idempotency_unique", partialFilterExpression: { isBatchLeader: true } }
);
packetSchema.index({ schoolId: 1, assessmentDeliveryVersionId: 1, createdAt: -1 });
packetSchema.index({ schoolId: 1, status: 1, createdAt: -1 });

const IMMUTABLE_PATHS = new Set([
  "schoolId",
  "assessmentDefinitionVersionId",
  "assessmentDeliveryVersionId",
  "deliveryContentHash",
  "packetId",
  "fallbackCode",
  "batchId",
  "batchSequence",
  "batchQuantity",
  "generationIdempotencyKey",
  "isBatchLeader",
  "batchFingerprint",
  "pageManifest",
  "createdBy",
  "issuedBy",
  "createdAt",
  "issuedAt",
]);

function updatePaths(update: Record<string, unknown>) {
  const paths = new Set<string>();
  for (const [key, value] of Object.entries(update)) {
    if (key === "$set" || key === "$unset" || key === "$setOnInsert") {
      if (value && typeof value === "object") {
        for (const nested of Object.keys(value as Record<string, unknown>)) paths.add(nested);
      }
    } else if (!key.startsWith("$")) {
      paths.add(key);
    }
  }
  return paths;
}

function assertMutableUpdate(update: Record<string, unknown>) {
  const illegal = [...updatePaths(update)].filter((path) => {
    const root = path.split(".")[0];
    return IMMUTABLE_PATHS.has(root);
  });
  if (illegal.length > 0) {
    throw new Error(`Published paper packet fields are immutable: ${illegal.join(", ")}`);
  }
}

packetSchema.pre("save", function (next) {
  if (!this.isNew) {
    for (const path of this.modifiedPaths()) {
      if (IMMUTABLE_PATHS.has(path.split(".")[0])) {
        return next(new Error(`Published paper packet field is immutable: ${path}`));
      }
    }
  }
  next();
});

for (const hook of ["updateOne", "updateMany", "findOneAndUpdate"] as const) {
  packetSchema.pre(hook, function (next) {
    try {
      assertMutableUpdate((this.getUpdate() ?? {}) as Record<string, unknown>);
      next();
    } catch (error) {
      next(error as Error);
    }
  });
}

export const AssessmentPaperPacket: Model<IAssessmentPaperPacket> =
  (models.AssessmentPaperPacket as Model<IAssessmentPaperPacket>) ||
  model<IAssessmentPaperPacket>("AssessmentPaperPacket", packetSchema);
