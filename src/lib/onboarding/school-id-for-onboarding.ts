import mongoose from "mongoose";
import { Application } from "@/models/Application";
import { Invitation } from "@/models/Invitation";
import { UserMembership } from "@/models/UserMembership";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toObjectIdOrNull(value: unknown): mongoose.Types.ObjectId | null {
  if (!value || !mongoose.isValidObjectId(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

/**
 * Membership-first school resolution for the /launch onboarding wizard.
 * Falls back through approved applications and school-admin invitations.
 */
export async function resolveSchoolIdForOnboarding(input: {
  userId?: mongoose.Types.ObjectId | null;
  email: string;
  userSchoolId?: unknown;
  clerkSchoolId?: string | null;
}): Promise<mongoose.Types.ObjectId | null> {
  const email = normalizeEmail(input.email);
  const fromUser = toObjectIdOrNull(input.userSchoolId);
  if (fromUser) return fromUser;

  const fromClerk = toObjectIdOrNull(input.clerkSchoolId);
  if (fromClerk) return fromClerk;

  if (input.userId) {
    const membership = await UserMembership.findOne({
      userId: input.userId,
      roles: "school_admin",
      status: { $in: ["active", "invited"] },
    })
      .sort({ updatedAt: -1 })
      .select("schoolId")
      .lean<{ schoolId?: mongoose.Types.ObjectId } | null>();

    if (membership?.schoolId) {
      return membership.schoolId instanceof mongoose.Types.ObjectId
        ? membership.schoolId
        : new mongoose.Types.ObjectId(String(membership.schoolId));
    }
  }

  if (email) {
    const approvedApp = await Application.findOne({
      adminEmail: email,
      status: "approved",
      linkedSchoolId: { $ne: null },
    })
      .sort({ updatedAt: -1 })
      .select("linkedSchoolId")
      .lean<{ linkedSchoolId?: mongoose.Types.ObjectId } | null>();

    if (approvedApp?.linkedSchoolId) {
      return toObjectIdOrNull(approvedApp.linkedSchoolId);
    }

    const invitation = await Invitation.findOne({
      email,
      role: "school_admin",
      status: { $in: ["pending", "accepted"] },
    })
      .sort({ acceptedAt: -1, sentAt: -1 })
      .select("schoolId")
      .lean<{ schoolId?: mongoose.Types.ObjectId } | null>();

    if (invitation?.schoolId) {
      return toObjectIdOrNull(invitation.schoolId);
    }
  }

  return null;
}
