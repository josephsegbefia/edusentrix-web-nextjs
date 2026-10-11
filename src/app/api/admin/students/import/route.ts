import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { isAcceptedStudentImportFilename } from "@/lib/students/student-import-parse";
import { persistAndEnqueueStudentImportAnalysis, serializeStudentImportJob } from "@/lib/students/student-import-workflow";

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission(["students.edit"]);
    await connectToDatabase();
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    if (!isAcceptedStudentImportFilename(file.name)) return NextResponse.json({ success: false, error: "Unsupported file type. Upload a CSV, TXT, or Excel (.xlsx/.xls) file." }, { status: 400 });
    const schoolIdObj = schoolId instanceof mongoose.Types.ObjectId ? schoolId : new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(String(userId));
    const classGroupIdRaw = String(formData.get("classGroupId") || "").trim();
    const placementMode = String(formData.get("placementMode") || (classGroupIdRaw ? "class_scoped" : "school_wide"));
    if (placementMode !== "school_wide" && placementMode !== "class_scoped") return NextResponse.json({ success: false, error: "Invalid placement mode" }, { status: 400 });
    let fixedClassGroupId: mongoose.Types.ObjectId | null = null; let fixedGradeId: mongoose.Types.ObjectId | null = null; let fixedClassLabel: string | null = null;
    if (placementMode === "class_scoped") {
      if (!mongoose.isValidObjectId(classGroupIdRaw)) return NextResponse.json({ success: false, error: "A target class group is required for class-scoped imports." }, { status: 400 });
      const target = await ClassGroup.findOne({ _id: classGroupIdRaw, schoolId: schoolIdObj, isActive: true }).select("_id gradeId name").lean();
      if (!target) return NextResponse.json({ success: false, error: "Target class group not found in this school." }, { status: 404 });
      fixedClassGroupId = target._id; fixedGradeId = target.gradeId; fixedClassLabel = target.name;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const queued = await persistAndEnqueueStudentImportAnalysis({ schoolId: schoolIdObj, createdByUserId: userIdObj, fileName: file.name, mimeType: file.type, fileBytes: bytes, placementMode, fixedGradeId, fixedClassGroupId, fixedClassLabel });
    return NextResponse.json({ success: true, jobId: queued.jobId, studentImportJobId: queued.studentImportJobId, data: serializeStudentImportJob(queued.job) }, { status: 202 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to import students" }, { status: 400 });
  }
}
