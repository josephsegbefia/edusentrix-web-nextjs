import "server-only";
import type { Types } from "mongoose";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";

export async function writePlatformAuditLog(input: {
  actorId: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  action: string;
  entityType?: string;
  entityId?: Types.ObjectId | null;
  metadata?: Record<string, unknown>;
}) {
  await PlatformAuditLog.create({
    actorId: input.actorId,
    schoolId: input.schoolId ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });
}
