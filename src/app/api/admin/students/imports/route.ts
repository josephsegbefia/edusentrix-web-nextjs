import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { StudentImportJob } from "@/models/StudentImportJob";
import { serializeStudentImportJob } from "@/lib/students/student-import-workflow";
export async function GET() { try { const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission(["students.edit"]); await connectToDatabase(); const jobs = await StudentImportJob.find({ schoolId }).sort({ createdAt: -1 }).limit(50).lean(); return Response.json({ success: true, data: jobs.map((job) => serializeStudentImportJob(job as never)) }); } catch (error) { if (error instanceof Response) return error; return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to load student imports" }, { status: 500 }); } }
