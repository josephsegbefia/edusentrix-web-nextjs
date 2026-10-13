import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { isAcceptedTeacherImportFilename } from "@/lib/teachers/parse-teacher-import";
import { TEACHER_IMPORT_MAX_BYTES } from "@/lib/teachers/teacher-import-workflow";
import {
  persistAndEnqueueTeacherImportAnalysis,
  serializeTeacherImportJob,
} from "@/lib/teachers/teacher-import-workflow";

export async function POST(req: NextRequest) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));
  const userIdObj =
    adminUserId instanceof mongoose.Types.ObjectId
      ? adminUserId
      : new mongoose.Types.ObjectId(String(adminUserId));

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    if (!isAcceptedTeacherImportFilename(file.name)) {
      return Response.json(
        { error: "Unsupported file type. Upload a CSV, XLS, or XLSX file." },
        { status: 400 }
      );
    }
    if (file.size > TEACHER_IMPORT_MAX_BYTES) {
      return Response.json({ error: "File is too large. Maximum size is 5MB." }, { status: 413 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const queued = await persistAndEnqueueTeacherImportAnalysis({
      schoolId: schoolIdObj,
      createdByUserId: userIdObj,
      fileName: file.name,
      mimeType: file.type,
      fileBytes: fileBuffer,
    });

    return Response.json(
      {
        success: true,
        jobId: queued.jobId,
        teacherImportJobId: queued.teacherImportJobId,
        data: { job: serializeTeacherImportJob(queued.job) },
      },
      { status: 202 }
    );
  } catch (error) {
    const errorCode = "TEACHER_IMPORT_UPLOAD_FAILED";
    console.error("teacher_import_upload_failed", {
      errorCode,
      route: "/api/admin/teachers/bulk-create",
      schoolId: String(schoolIdObj),
      workflow: "teacher_import",
      phase: "upload_enqueue",
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      {
        success: false,
        errorCode,
        error: "We could not start the teacher import. Please try again or upload the file again.",
      },
      { status: 500 }
    );
  }
}
