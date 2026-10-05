import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { isAcceptedStudentImportFilename } from "@/lib/students/student-import-parse";
import { resolveFixedClassTarget } from "@/lib/students/student-import-service";
import { persistAndEnqueueBulkImport, serializeBulkImportJob } from "@/lib/imports/enqueue-bulk-import";

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "students.edit",
    ]);
    await connectToDatabase();

    if (!mongoose.models.Grade) {
      void Grade.modelName;
    }
    if (!mongoose.models.ClassGroup) {
      void ClassGroup.modelName;
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const classGroupIdRaw = formData.get("classGroupId");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (!isAcceptedStudentImportFilename(file.name)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unsupported file type. Upload a CSV, TXT, or Excel (.xlsx/.xls) file.",
        },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj =
      userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(String(userId));

    let classGroupId: mongoose.Types.ObjectId | null = null;
    if (typeof classGroupIdRaw === "string" && classGroupIdRaw.trim()) {
      const fixedClass = await resolveFixedClassTarget({
        schoolId: schoolIdObj,
        classGroupId: classGroupIdRaw.trim(),
      });
      if (!fixedClass) {
        return NextResponse.json(
          { success: false, error: "Target class group not found" },
          { status: 404 }
        );
      }
      classGroupId = new mongoose.Types.ObjectId(fixedClass.classGroupId);
    }

    const queued = await persistAndEnqueueBulkImport({
      schoolId: schoolIdObj,
      createdBy: userIdObj,
      targetKind: "students",
      fileName: file.name,
      mimeType: file.type,
      fileBytes: Buffer.from(await file.arrayBuffer()),
      classGroupId,
    });

    return NextResponse.json(
      {
        success: true,
        jobId: queued.jobId,
        bulkImportJobId: queued.bulkImportJobId,
        data: serializeBulkImportJob(queued.job),
      },
      { status: 202 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to import students";
    return NextResponse.json(
      { success: false, error: message, created: 0, failed: 0, errors: [] },
      { status: 500 }
    );
  }
}
