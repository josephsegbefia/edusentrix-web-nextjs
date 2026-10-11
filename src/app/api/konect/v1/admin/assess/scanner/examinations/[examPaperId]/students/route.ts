import { NextResponse } from "next/server";
import { Student } from "@/models/Student";
import { scannerContext, eligibleExam } from "@/lib/konect/script-submission-service";

export async function GET(_req: Request, { params }: { params: Promise<{ examPaperId: string }> }) {
  const ctx = await scannerContext();
  const { examPaperId } = await params;
  const paper = await eligibleExam(examPaperId, ctx.schoolId);
  const classGroupIds = [paper.classGroupId, ...(paper.classGroupIds ?? [])].filter(Boolean);
  const filter = paper.scope === "grade_wide"
    ? { schoolId: ctx.schoolId, gradeId: paper.gradeId, status: "active" }
    : { schoolId: ctx.schoolId, classGroupId: { $in: classGroupIds }, status: "active" };
  const students = await Student.find(filter).select({ _id: 1, firstName: 1, middleName: 1, lastName: 1, admissionNo: 1, classGroupId: 1, gradeId: 1 }).sort({ lastName: 1, firstName: 1 }).limit(500).lean();
  return NextResponse.json({ success: true, data: students.map((student) => ({ id: String(student._id), firstName: student.firstName, middleName: student.middleName ?? null, lastName: student.lastName, admissionNo: student.admissionNo ?? null, classGroupId: String(student.classGroupId), gradeId: String(student.gradeId) })) });
}
