import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { Curriculum, type ICurriculum } from "@/models/Curriculum";
import { CurriculumSubject, type ICurriculumSubject } from "@/models/CurriculumSubject";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";

function parseId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

const CreateSchema = z.object({
  subjectId: z.string().min(1),
  gradeId: z.string().nullable().optional(),
  order: z.number().int().min(0).optional(),
});

function serializeRow(
  r: ICurriculumSubject,
  subjectName: string | null,
  gradeName: string | null
) {
  return {
    id: String(r._id),
    curriculumId: String(r.curriculumId),
    subjectId: String(r.subjectId),
    subjectName,
    gradeId: r.gradeId ? String(r.gradeId) : null,
    gradeName,
    order: r.order,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const curriculumId = parseId(id);
    if (!curriculumId) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const curriculum = (await Curriculum.findOne({
      _id: curriculumId,
      schoolId: admin.schoolId,
    })
      .select("_id")
      .lean()) as Pick<ICurriculum, "_id"> | null;
    if (!curriculum) {
      return Response.json({ success: false, error: "Curriculum not found" }, { status: 404 });
    }

    const rows = (await CurriculumSubject.find({
      schoolId: admin.schoolId,
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
            schoolId: admin.schoolId,
            _id: { $in: subjectIds.map((x) => new mongoose.Types.ObjectId(x)) },
          })
            .select("name")
            .lean()
        : [],
      gradeIds.length
        ? Grade.find({
            schoolId: admin.schoolId,
            _id: { $in: gradeIds.map((x) => new mongoose.Types.ObjectId(x)) },
          })
            .select("name")
            .lean()
        : [],
    ]);

    const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));
    const gradeName = new Map(grades.map((g) => [String(g._id), g.name]));

    return Response.json({
      success: true,
      data: {
        curriculumSubjects: rows.map((r) =>
          serializeRow(
            r,
            subjectName.get(String(r.subjectId)) ?? null,
            r.gradeId ? gradeName.get(String(r.gradeId)) ?? null : null
          )
        ),
      },
    });
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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const curriculumId = parseId(id);
    if (!curriculumId) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const curriculum = (await Curriculum.findOne({
      _id: curriculumId,
      schoolId: admin.schoolId,
    })
      .select("_id")
      .lean()) as Pick<ICurriculum, "_id"> | null;
    if (!curriculum) {
      return Response.json({ success: false, error: "Curriculum not found" }, { status: 404 });
    }

    const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const subjectOid = parseId(parsed.data.subjectId);
    if (!subjectOid) {
      return Response.json({ success: false, error: "Invalid subjectId" }, { status: 400 });
    }

    const subject = await Subject.findOne({
      _id: subjectOid,
      schoolId: admin.schoolId,
    })
      .select("name")
      .lean();
    if (!subject) {
      return Response.json({ success: false, error: "Subject not found" }, { status: 404 });
    }

    let gradeOid: mongoose.Types.ObjectId | null = null;
    if (parsed.data.gradeId) {
      const g = parseId(parsed.data.gradeId);
      if (!g) {
        return Response.json({ success: false, error: "Invalid gradeId" }, { status: 400 });
      }
      const grade = await Grade.findOne({ _id: g, schoolId: admin.schoolId }).select("_id").lean();
      if (!grade) {
        return Response.json({ success: false, error: "Grade not found" }, { status: 404 });
      }
      gradeOid = g;
    }

    let order = parsed.data.order;
    if (order === undefined) {
      const agg = await CurriculumSubject.findOne({
        schoolId: admin.schoolId,
        curriculumId,
      })
        .sort({ order: -1 })
        .select("order")
        .lean();
      order = agg ? agg.order + 1 : 0;
    }

    try {
      const created = await CurriculumSubject.create({
        schoolId: admin.schoolId,
        curriculumId,
        subjectId: subjectOid,
        gradeId: gradeOid,
        order,
      });
      const row = created.toObject() as ICurriculumSubject;
      let gName: string | null = null;
      if (gradeOid) {
        const gDoc = await Grade.findById(gradeOid).select("name").lean();
        gName = gDoc?.name ?? null;
      }
      return Response.json({
        success: true,
        data: {
          curriculumSubject: serializeRow(row, subject.name, gName),
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("E11000") || msg.includes("duplicate")) {
        return Response.json(
          { success: false, error: "This subject and grade are already in this framework" },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add curriculum subject",
      },
      { status: 500 }
    );
  }
}
