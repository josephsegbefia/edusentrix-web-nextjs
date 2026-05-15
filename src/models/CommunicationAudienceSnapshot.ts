import { Schema, model, models, Types, type Model } from "mongoose";

export interface ICommunicationAudienceSnapshot {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  communicationId: Types.ObjectId;
  recipientCount: number;
  channelReach: {
    inApp: number;
    email: number;
    whatsapp: number;
    sms: number;
    missingContact: number;
  };
  recipients: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

const communicationAudienceSnapshotSchema =
  new Schema<ICommunicationAudienceSnapshot>(
    {
      schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
      communicationId: {
        type: Schema.Types.ObjectId,
        ref: "Communication",
        required: true,
        index: true,
      },
      recipientCount: { type: Number, required: true },
      channelReach: {
        inApp: { type: Number, default: 0 },
        email: { type: Number, default: 0 },
        whatsapp: { type: Number, default: 0 },
        sms: { type: Number, default: 0 },
        missingContact: { type: Number, default: 0 },
      },
      recipients: { type: [Schema.Types.Mixed], default: [] },
    },
    { timestamps: true },
  );

communicationAudienceSnapshotSchema.index({ communicationId: 1, createdAt: -1 });

export const CommunicationAudienceSnapshot: Model<ICommunicationAudienceSnapshot> =
  (models.CommunicationAudienceSnapshot as Model<ICommunicationAudienceSnapshot>) ||
  model<ICommunicationAudienceSnapshot>(
    "CommunicationAudienceSnapshot",
    communicationAudienceSnapshotSchema,
  );
