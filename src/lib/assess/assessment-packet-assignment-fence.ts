import type { Types, ClientSession } from "mongoose";
import { AssessmentPaperPacketAssignment } from "@/models/AssessmentPaperPacketAssignment";

/**
 * Touch the authoritative packet assignment inside a transaction before an
 * operation derives an academic result from it. Candidate correction also
 * writes this document, so MongoDB snapshot transactions receive a write
 * conflict instead of allowing stale identity observations to commit beside
 * one another.
 */
export async function fenceActivePacketAssignment(input: {
  session: ClientSession;
  schoolId: Types.ObjectId;
  assignmentId: Types.ObjectId;
  deliveryId: Types.ObjectId;
  studentId: Types.ObjectId;
}) {
  const result = await AssessmentPaperPacketAssignment.updateOne(
    {
      _id: input.assignmentId,
      schoolId: input.schoolId,
      assessmentDeliveryVersionId: input.deliveryId,
      studentId: input.studentId,
      status: "active",
    },
    { $set: { updatedAt: new Date() } },
    { session: input.session, timestamps: false }
  );
  return result.matchedCount === 1;
}
