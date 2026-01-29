import { Schema, model, models, Types } from "mongoose";

export interface ITeacherPermission {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  name: string;
  description?: string;
  permissions: string[];
  createdBy?: Types.ObjectId | null;
  isSystem?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teacherPermissionSchema = new Schema<ITeacherPermission>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    permissions: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

teacherPermissionSchema.index({ schoolId: 1, name: 1 }, { unique: true });

export const TeacherPermission =
  models.TeacherPermission ||
  model<ITeacherPermission>("TeacherPermission", teacherPermissionSchema);
