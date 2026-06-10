/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import mongoose from "mongoose";
import {
  isAcceptedStudentImportFilename,
  parseStudentImportFile,
} from "@/lib/students/student-import-parse";
import {
  importStudentsFromRows,
  resolveFixedClassTarget,
} from "@/lib/students/student-import-service";

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
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

    let fixedClass = null;
    if (typeof classGroupIdRaw === "string" && classGroupIdRaw.trim()) {
      fixedClass = await resolveFixedClassTarget({
        schoolId: schoolIdObj,
        classGroupId: classGroupIdRaw.trim(),
      });
      if (!fixedClass) {
        return NextResponse.json(
          { success: false, error: "Target class group not found" },
          { status: 404 }
        );
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseStudentImportFile(buffer, file.name);

    const result = await importStudentsFromRows({
      schoolId: schoolIdObj,
      rows,
      fixedClass,
    });

    if (
      result.created === 0 &&
      result.errors.length === 1 &&
      result.errors[0]?.row === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: result.errors[0].message,
          created: 0,
          failed: result.failed,
          errors: result.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: result.created > 0 ? 201 : 400 });
  } catch (e: unknown) {
    console.error("Student import error:", e);
    const message =
      e instanceof Error ? e.message : "Failed to import students";
    return NextResponse.json(
      { success: false, error: message, created: 0, failed: 0, errors: [] },
      { status: 500 }
    );
  }
}
