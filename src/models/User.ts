import { Schema, model, models, Types } from "mongoose";
export type AppRole =
  | "platform_admin"
  | "school_admin"
  | "staff"
  | "non_teaching_staff"
  | "teacher"
  | "parent"
  | "student";

export interface IUser {
  _id: Types.ObjectId;
  supabaseUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  role: AppRole;
  roles?: AppRole[];
  schoolId?: Types.ObjectId | null;
  pendingOnboarding?: boolean;
  dateOfBirth?: Date;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    supabaseUserId: { type: String, required: true, index: true, unique: true },
    email: { type: String, required: true, lowercase: true, index: true },
    firstName: String,
    lastName: String,
    avatarUrl: String,
    role: {
      type: String,
      enum: [
        "platform_admin",
        "school_admin",
        "staff",
        "non_teaching_staff",
        "teacher",
        "parent",
        "student",
      ],
      required: true,
    },
    roles: { type: [String], default: [] },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null },
    pendingOnboarding: { type: Boolean, default: false },
    dateOfBirth: Date,
    address: String,
  },
  { timestamps: true }
);

userSchema.index({ email: 1, supabaseUserId: 1 });

export const User = models.User || model<IUser>("User", userSchema);
