import { Schema, model, models, Types, type Model } from "mongoose";

/** Parent-defined purchase order for supply program lines (per ward). */
export interface IParentSupplyPriority {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  parentUserId: Types.ObjectId;
  studentId: Types.ObjectId;
  programId: Types.ObjectId;
  /** Ordered SupplyProgramLine ids (most urgent first) */
  orderedLineIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const parentSupplyPrioritySchema = new Schema<IParentSupplyPriority>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    parentUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: "SupplyProgram",
      required: true,
      index: true,
    },
    orderedLineIds: [{ type: Schema.Types.ObjectId, ref: "SupplyProgramLine" }],
  },
  { timestamps: true }
);

parentSupplyPrioritySchema.index(
  { parentUserId: 1, studentId: 1, programId: 1 },
  { unique: true }
);

export const ParentSupplyPriority: Model<IParentSupplyPriority> =
  (models.ParentSupplyPriority as Model<IParentSupplyPriority>) ||
  model<IParentSupplyPriority>("ParentSupplyPriority", parentSupplyPrioritySchema);
