import mongoose from "mongoose";
import { resolveSchoolAccessMode } from "@/lib/billing/resolve-school-access-mode";

const DEFAULT_ALLOWED_RESTRICTED_ACTIONS = new Set([
  "subscription.view",
  "subscription.renewal_request",
  "billing.contact_support",
  "billing.download_usage_summary",
]);

export class SchoolWriteAccessError extends Error {
  statusCode = 403;

  constructor(
    message: string,
    public readonly accessMode: string,
    public readonly action: string
  ) {
    super(message);
    this.name = "SchoolWriteAccessError";
  }
}

export async function requireSchoolWriteAccess(input: {
  schoolId: string | mongoose.Types.ObjectId;
  action: string;
  allowedRestrictedActions?: string[];
}) {
  const accessMode = await resolveSchoolAccessMode(input.schoolId);
  const allowedActions = new Set([
    ...DEFAULT_ALLOWED_RESTRICTED_ACTIONS,
    ...(input.allowedRestrictedActions || []),
  ]);

  if (
    (accessMode === "restricted_read_only" || accessMode === "suspended") &&
    !allowedActions.has(input.action)
  ) {
    throw new SchoolWriteAccessError(
      "This school subscription does not currently allow this action.",
      accessMode,
      input.action
    );
  }

  return { accessMode };
}
