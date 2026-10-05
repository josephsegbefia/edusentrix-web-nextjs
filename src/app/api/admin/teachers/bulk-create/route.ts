import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { persistAndEnqueueBulkImport, serializeBulkImportJob } from "@/lib/imports/enqueue-bulk-import";
import { isAcceptedTeacherImportFilename } from "@/lib/teachers/parse-teacher-import";

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

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const queued = await persistAndEnqueueBulkImport({
      schoolId: schoolIdObj,
      createdBy: userIdObj,
      targetKind: "teachers",
      fileName: file.name,
      mimeType: file.type,
      fileBytes: fileBuffer,
    });

    return Response.json(
      {
        success: true,
        jobId: queued.jobId,
        bulkImportJobId: queued.bulkImportJobId,
        data: serializeBulkImportJob(queued.job),
      },
      { status: 202 }
    );
  } catch (error) {
    return Response.json(
      {
        error: "Failed to process bulk import",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
