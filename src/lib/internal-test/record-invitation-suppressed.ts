import "server-only";
import mongoose from "mongoose";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";

export async function recordInvitationEmailSuppressed(input: {
  schoolId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  templateKey: string;
  targetEmail: string;
}) {
  await PlatformAuditLog.create({
    actorId: input.actorId,
    schoolId: input.schoolId,
    action: "internal_test.invitation_suppressed",
    entityType: "invitation",
    metadata: {
      channel: "email",
      templateKey: input.templateKey,
      targetEmail: input.targetEmail,
    },
  });
}
