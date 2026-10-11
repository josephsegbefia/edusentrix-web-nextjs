import mongoose from "mongoose";
export function assertStudentImportId(value: string) { return mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null; }
