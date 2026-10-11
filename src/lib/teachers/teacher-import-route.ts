import mongoose from "mongoose";

export function assertTeacherImportId(id: string) {
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}
