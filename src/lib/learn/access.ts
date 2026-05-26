import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getSchoolLearnEligibility, type SchoolLearnEligibility } from "@/lib/learn/eligibility";
import { LearnAccess, type ILearnAccess, type LearnAccessSource } from "@/models/LearnAccess";

export type StudentLearnAccessResult = {
  hasAccess: boolean;
  schoolEligible: boolean;
  schoolEligibility: SchoolLearnEligibility;
  access: Pick<ILearnAccess, "source" | "status" | "expiresAt"> | null;
  accessStatus:
    | "active"
    | "expired"
    | "revoked"
    | "pending_payment"
    | "gifted"
    | "not_available";
  blockedReason?: string;
};

function mapAccessStatus(
  schoolEligible: boolean,
  access: Pick<ILearnAccess, "source" | "status" | "expiresAt"> | null
): StudentLearnAccessResult["accessStatus"] {
  if (!schoolEligible) return "not_available";
  if (!access) return "pending_payment";
  if (access.status === "revoked") return "revoked";
  if (access.status === "expired" || access.expiresAt <= new Date()) return "expired";
  if (access.source === "platform_gift") return "gifted";
  return "active";
}

export async function getStudentLearnAccess(input: {
  schoolId: Types.ObjectId | string;
  studentId: Types.ObjectId | string;
  accountId?: Types.ObjectId | string | null;
}): Promise<StudentLearnAccessResult> {
  await connectToDatabase();

  const schoolId =
    input.schoolId instanceof Types.ObjectId
      ? input.schoolId
      : new Types.ObjectId(input.schoolId);
  const studentId =
    input.studentId instanceof Types.ObjectId
      ? input.studentId
      : new Types.ObjectId(input.studentId);

  const schoolEligibility = await getSchoolLearnEligibility(schoolId);
  const now = new Date();

  const accessQuery: Record<string, unknown> = {
    schoolId,
    studentId,
    status: "active",
    expiresAt: { $gt: now },
  };

  if (input.accountId) {
    accessQuery.accountId =
      input.accountId instanceof Types.ObjectId
        ? input.accountId
        : new Types.ObjectId(input.accountId);
  }

  const access = await LearnAccess.findOne(accessQuery)
    .sort({ expiresAt: -1 })
    .select("source status expiresAt")
    .lean<Pick<ILearnAccess, "source" | "status" | "expiresAt"> | null>();

  const accessStatus = mapAccessStatus(schoolEligibility.eligible, access);
  const hasAccess = schoolEligibility.eligible && accessStatus === "active";

  let blockedReason: string | undefined;
  if (!schoolEligibility.eligible) {
    blockedReason = schoolEligibility.reason;
  } else if (!hasAccess) {
    if (accessStatus === "expired") {
      blockedReason = "Your EduSentrix Learn access has expired for this term.";
    } else if (accessStatus === "revoked") {
      blockedReason = "Your EduSentrix Learn access is not active.";
    } else {
      blockedReason = "EduSentrix Learn access is required for this term.";
    }
  }

  return {
    hasAccess,
    schoolEligible: schoolEligibility.eligible,
    schoolEligibility,
    access,
    accessStatus,
    blockedReason,
  };
}

export function toMobileAccessSource(
  source: LearnAccessSource | undefined
): "parent_paid" | "platform_gift" | "school_sponsored" | null {
  if (!source) return null;
  if (source === "parent_paid") return "parent_paid";
  if (source === "platform_gift") return "platform_gift";
  if (source === "school_sponsored" || source === "manual_grant") {
    return "school_sponsored";
  }
  return null;
}
