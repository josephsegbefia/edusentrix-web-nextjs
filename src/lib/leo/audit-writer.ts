import "server-only";
import type { Types } from "mongoose";
import { AuditEvent } from "@/models/AuditEvent";

type LeoActionAuditArgs = {
  schoolId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  actorRole: string;
  actionRunId: Types.ObjectId;
  actionKey: string;
  route?: string | null;
  previewInput: Record<string, unknown>;
  previewOutput?: Record<string, unknown> | null;
  executeInput?: Record<string, unknown> | null;
  executeOutput?: Record<string, unknown> | null;
  result: "succeeded" | "failed";
  errorMessage?: string | null;
};

export async function writeLeoActionAudit(args: LeoActionAuditArgs) {
  const now = new Date();
  return AuditEvent.create({
    scopeType: "school",
    scopeId: args.schoolId,
    domain: "system",
    tier: 1,
    actionCode: `leo.action.${args.actionKey}`,
    result: args.result,
    occurredAt: now,
    recordedAt: now,
    actorType: "ai_assist",
    actorId: args.actorUserId,
    actorRole: args.actorRole,
    targetEntityType: "LeoActionRun",
    targetEntityId: args.actionRunId,
    routePath: args.route ?? null,
    clientSurface: "leo_copilot",
    before: args.previewInput,
    after: args.executeOutput ?? args.previewOutput ?? null,
    metadata: {
      actionKey: args.actionKey,
      previewOutput: args.previewOutput ?? null,
      executeInput: args.executeInput ?? null,
      errorMessage: args.errorMessage ?? null,
    },
    sensitivity: "moderate",
    redactionMode: "none",
    retentionClass: "operational",
  });
}
