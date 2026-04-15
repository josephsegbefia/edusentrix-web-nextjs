import { Types } from "mongoose";

export function toObjectId(
  id: string | Types.ObjectId | undefined | null
): Types.ObjectId | null {
  if (id == null) return null;
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}
