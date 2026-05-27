import mongoose from "mongoose";
import type { SchoolAccessMode } from "@/lib/billing/resolve-school-access-mode";

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

/** No subscription write restrictions. */
export async function requireSchoolWriteAccess(_input: {
  schoolId: string | mongoose.Types.ObjectId;
  action: string;
  allowedRestrictedActions?: string[];
}) {
  return { accessMode: "full" as SchoolAccessMode };
}
