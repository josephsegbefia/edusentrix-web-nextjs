import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Curriculum } from "@/models/Curriculum";
import { CurriculumSubject, type ICurriculumSubject } from "@/models/CurriculumSubject";
import { Subject } from "@/models/Subject";
import { Grade } from "@/models/Grade";

export async function GET(req: Request) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.curriculumFrameworkRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const curriculumIdRaw = searchParams.get("curriculumId");
    if (!curriculumIdRaw || !mongoose.Types.ObjectId.isValid(curriculumIdRaw)) {
      return Response.json({ success: false, error: "curriculumId is required" }, { status: 400 });
    }
    const curriculumId = new mongoose.Types.ObjectId(curriculumIdRaw);

    const curriculum = await Curriculum.findOne({
      _id: curriculumId,
      schoolId: ctx.schoolId,
    })
      .select("_id")
      .lean();
    if (!curriculum) {
      return Response.json({ success: false, error: "Curriculum not found" }, { status: 404 });
    }

    const rows = (await CurriculumSubject.find({
      schoolId: ctx.schoolId,
      curriculumId,
    })
      .sort({ order: 1 })
      .lean()) as ICurriculumSubject[];

    const subjectIds = [...new Set(rows.map((r) => String(r.subjectId)))];
    const gradeIds = [
      ...new Set(rows.filter((r) => r.gradeId).map((r) => String(r.gradeId!))),
    ];

    const [subjects, grades] = await Promise.all([
      subjectIds.length
        ? Subject.find({
            schoolId: ctx.schoolId,
            _id: { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
          })
            .select("name code")
            .lean()
        : [],
      gradeIds.length
        ? Grade.find({
            schoolId: ctx.schoolId,
            _id: { $in: gradeIds.map((id) => new mongoose.Types.ObjectId(id)) },
          })
            .select("name")
            .lean()
        : [],
    ]);

    const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));
    const gradeName = new Map(grades.map((g) => [String(g._id), g.name]));

    const data = rows.map((r) => ({
      id: String(r._id),
      curriculumId: String(r.curriculumId),
      subjectId: String(r.subjectId),
      subjectName: subjectName.get(String(r.subjectId)) ?? null,
      gradeId: r.gradeId ? String(r.gradeId) : null,
      gradeName: r.gradeId ? gradeName.get(String(r.gradeId)) ?? null : null,
      order: r.order,
    }));

    return Response.json({ success: true, data: { curriculumSubjects: data } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list curriculum subjects",
      },
      { status: 500 }
    );
  }
}
