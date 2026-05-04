import "server-only";
import mongoose from "mongoose";
import { clerkClient } from "@clerk/nextjs/server";
import { User } from "@/models/User";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Guardian } from "@/models/Guardian";
import { UserMembership } from "@/models/UserMembership";
import { Invitation } from "@/models/Invitation";
import { Student } from "@/models/Student";
import { School } from "@/models/School";
import { ClassGroup } from "@/models/ClassGroup";
import { deleteUploadedFile } from "@/lib/uploads/delete";

export type DeleteTestUserResult = {
  userId: string;
  clerkDeleted: boolean;
  mongoDeleted: boolean;
  error?: string;
};

/**
 * Hard-delete a synthetic QA user and common dependents. Caller must ensure `user.isTestUser`.
 */
export async function deleteTestUserById(
  userId: mongoose.Types.ObjectId
): Promise<DeleteTestUserResult> {
  const user = await User.findById(userId)
    .select("isTestUser clerkUserId email schoolId avatarUrl role")
    .lean<{
      isTestUser?: boolean;
      clerkUserId?: string;
      email?: string;
      schoolId?: mongoose.Types.ObjectId;
      avatarUrl?: string;
      role?: string;
    } | null>();

  if (!user) {
    return { userId: String(userId), clerkDeleted: false, mongoDeleted: false, error: "User not found" };
  }
  if (!user.isTestUser) {
    return {
      userId: String(userId),
      clerkDeleted: false,
      mongoDeleted: false,
      error: "Refusing to delete non-test user",
    };
  }

  const schoolId = user.schoolId;

  try {
    const teacher = await Teacher.findOne({ userId }).select("_id").lean();
    if (teacher?._id) {
      const tid = teacher._id as mongoose.Types.ObjectId;
      await TeacherAssignment.deleteMany({ teacherId: tid });
      await ClassGroup.updateMany(
        { homeroomTeacherId: tid, ...(schoolId ? { schoolId } : {}) },
        { $unset: { homeroomTeacherId: 1 } }
      );
      await Teacher.deleteOne({ _id: tid });
    }

    await Guardian.deleteMany({ userId });
    await Student.updateMany({ userId }, { $unset: { userId: 1 } });

    if (schoolId) {
      await School.updateOne(
        {
          _id: schoolId,
          "billing.paymentSetup.delegateUserId": userId,
        },
        {
          $set: {
            "billing.paymentSetup.delegateUserId": null,
            "billing.paymentSetup.delegateName": null,
            "billing.paymentSetup.delegateEmail": null,
            "billing.paymentSetup.delegateAssignedAt": null,
            "billing.paymentSetup.delegateAssignedBy": null,
            "billing.paymentSetup.lastUpdatedAt": new Date(),
          },
        }
      );
    }

    if (user.email && schoolId) {
      await Invitation.deleteMany({
        schoolId,
        email: user.email.toLowerCase().trim(),
      });
    }

    await UserMembership.deleteMany({ userId });

    if (user.avatarUrl) {
      await deleteUploadedFile(user.avatarUrl).catch(() => undefined);
    }

    if (user.clerkUserId) {
      try {
        const clerk = await clerkClient();
        await clerk.users.deleteUser(user.clerkUserId);
      } catch (e) {
        console.error("deleteTestUserById: Clerk delete failed", e);
      }
    }

    await User.deleteOne({ _id: userId });

    return { userId: String(userId), clerkDeleted: Boolean(user.clerkUserId), mongoDeleted: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { userId: String(userId), clerkDeleted: false, mongoDeleted: false, error: message };
  }
}
