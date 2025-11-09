/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClientSession, Types } from "mongoose";
import { ApplicationAudit, AuditAction } from "@/models/ApplicationAudit";

export async function recordApplicationAudit(
  params: {
    applicationId: string | Types.ObjectId;
    action: AuditAction;
    by?: string | Types.ObjectId | null;
    note?: string;
    meta?: Record<string, any> | null;
  },
  options?: { session?: ClientSession }
) {
  const { applicationId, action, by, note, meta } = params;
  await ApplicationAudit.create(
    {
      applicationId: new Types.ObjectId(applicationId),
      action,
      by: by ? new Types.ObjectId(by as any) : null,
      note,
      meta: meta ?? null,
    },
    options
  );
}
