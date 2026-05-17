import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { requireSchoolAdminOrTeacherRead } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { SubjectOffering } from "@/models/SubjectOffering";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { isPreschoolLearningAreaGrade } from "@/constants/curriculum-subject-templates";

function toObjectIdOrNull(value: string | null): mongoose.Types.ObjectId | null {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function normalizeSubjectKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function gradeBandForGrade(grade: {
  code?: string | null;
  name?: string | null;
  stage?: string | null;
}): string {
  const raw = `${grade.code ?? ""} ${grade.name ?? ""} ${grade.stage ?? ""}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  if (/^(CRECHE|NURSERY|KG1|KG2)|KINDERGARTEN/.test(raw)) return "preschool";
  if (/(^|[^0-9])(P1|P2|P3|B1|B2|B3|BASIC1|BASIC2|BASIC3|PRIMARY1|PRIMARY2|PRIMARY3|GRADE1|GRADE2|GRADE3)/.test(raw)) {
    return "lower_primary";
  }
  if (/(^|[^0-9])(P4|P5|P6|B4|B5|B6|BASIC4|BASIC5|BASIC6|PRIMARY4|PRIMARY5|PRIMARY6|GRADE4|GRADE5|GRADE6)/.test(raw)) {
    return "upper_primary";
  }
  if (/JHS[123]/.test(raw) || raw.includes("JHS")) return "jhs";
  return "custom";
}

function serializeOffering(row: any, maps: {
  gradeNames: Map<string, string>;
  classCounts: Map<string, number>;
  teacherCounts: Map<string, number>;
}) {
  const gradeIds = Array.isArray(row.gradeIds) ? row.gradeIds.map((id: unknown) => String(id)) : [];
  return {
    id: String(row._id),
    subjectId: String(row.subjectId),
    subjectFamily: row.subjectFamily,
    displayName: row.displayName,
    shortName: row.shortName,
    code: row.code,
    curriculumCode: row.curriculumCode,
    stage: row.stage,
    gradeBand: row.gradeBand,
    gradeIds,
    gradeNames: gradeIds.map((id) => maps.gradeNames.get(id)).filter(Boolean),
    category: row.category,
    lessonNoteTemplateVariant: row.lessonNoteTemplateVariant ?? null,
    assignedClassGroupCount: maps.classCounts.get(String(row._id)) ?? 0,
    assignedTeacherCount: maps.teacherCounts.get(String(row._id)) ?? 0,
    isActive: row.isActive !== false,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrTeacherRead();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);
    const query: Record<string, unknown> = { schoolId: schoolIdObj };
    const search = (searchParams.get("search") || "").trim();
    const gradeId = toObjectIdOrNull(searchParams.get("gradeId"));

    for (const key of ["curriculumCode", "stage", "gradeBand", "category"] as const) {
      const value = searchParams.get(key);
      if (value && value !== "all") query[key] = value;
    }
    const isActive = searchParams.get("isActive");
    if (isActive === "true" || isActive === "false") query.isActive = isActive === "true";
    if (gradeId) query.gradeIds = gradeId;
    if (search) {
      query.$or = [
        { displayName: new RegExp(search, "i") },
        { shortName: new RegExp(search, "i") },
        { subjectFamily: new RegExp(search, "i") },
        { code: new RegExp(search, "i") },
      ];
    }

    const offerings = await SubjectOffering.find(query).sort({ gradeBand: 1, displayName: 1 }).lean();
    const offeringIds = offerings.map((row) => row._id);
    const allGradeIds = [...new Set(offerings.flatMap((row: any) => (row.gradeIds || []).map(String)))];

    const [grades, classCounts, teacherCounts] = await Promise.all([
      allGradeIds.length
        ? Grade.find({ _id: { $in: allGradeIds }, schoolId: schoolIdObj }).select("name").lean()
        : [],
      offeringIds.length
        ? ClassGroup.aggregate([
            { $match: { schoolId: schoolIdObj, subjectOfferingIds: { $in: offeringIds } } },
            { $unwind: "$subjectOfferingIds" },
            { $match: { subjectOfferingIds: { $in: offeringIds } } },
            { $group: { _id: "$subjectOfferingIds", count: { $sum: 1 } } },
          ])
        : [],
      offeringIds.length
        ? TeacherAssignment.aggregate([
            {
              $match: {
                schoolId: schoolIdObj,
                subjectOfferingId: { $in: offeringIds },
                status: "active",
              },
            },
            { $group: { _id: "$subjectOfferingId", uniqueTeachers: { $addToSet: "$teacherId" } } },
            { $project: { count: { $size: "$uniqueTeachers" } } },
          ])
        : [],
    ]);

    const maps = {
      gradeNames: new Map(grades.map((grade: any) => [String(grade._id), String(grade.name)])),
      classCounts: new Map(classCounts.map((row: any) => [String(row._id), Number(row.count)])),
      teacherCounts: new Map(teacherCounts.map((row: any) => [String(row._id), Number(row.count)])),
    };

    return NextResponse.json({
      success: true,
      data: offerings.map((row) => serializeOffering(row, maps)),
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch subject offerings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("subjects");
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();
    let subjectId = toObjectIdOrNull(String(body.subjectId || ""));
    const gradeIds = Array.isArray(body.gradeIds)
      ? body.gradeIds.filter((id: unknown) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id)).map((id: string) => new mongoose.Types.ObjectId(id))
      : [];

    const required = ["curriculumCode", "subjectFamily", "displayName", "shortName", "code", "stage", "gradeBand", "category"];
    for (const key of required) {
      if (typeof body[key] !== "string" || !body[key].trim()) {
        return NextResponse.json({ success: false, error: `${key} is required` }, { status: 400 });
      }
    }

    const curriculumCode = String(body.curriculumCode).trim();
    const displayName = String(body.displayName).trim();
    const shortName = String(body.shortName).trim();
    const offeringCode = String(body.code).trim().toUpperCase();
    const stage = String(body.stage).trim();
    const category = String(body.category).trim();
    const subjectFamily = String(body.subjectFamily).trim();
    const normalizedKey = normalizeSubjectKey(subjectFamily);

    let subject = subjectId
      ? await Subject.findOne({ _id: subjectId, schoolId: schoolIdObj }).select("_id").lean()
      : await Subject.findOne({
          schoolId: schoolIdObj,
          $or: [{ normalizedKey }, { name: subjectFamily }],
        })
          .collation({ locale: "en", strength: 2 })
          .select("_id normalizedKey")
          .lean();

    if (!subject) {
      subject = await Subject.create({
        schoolId: schoolIdObj,
        name: subjectFamily,
        normalizedKey,
        code: null,
        category: String(body.category),
        isActive: true,
      });
    } else if (!(subject as { normalizedKey?: string }).normalizedKey) {
      await Subject.updateOne(
        { _id: subject._id, schoolId: schoolIdObj },
        { $set: { normalizedKey } }
      );
    }
    subjectId = subject._id as mongoose.Types.ObjectId;

    const [, gradeRows] = await Promise.all([
      Promise.resolve(subject),
      gradeIds.length
        ? Grade.find({ _id: { $in: gradeIds }, schoolId: schoolIdObj }).select("_id name code").lean()
        : Promise.resolve([]),
    ]);
    if (gradeRows.length !== gradeIds.length) {
      return NextResponse.json({ success: false, error: "One or more grades do not belong to this school" }, { status: 400 });
    }
    const gradeBand = String(body.gradeBand);
    if (gradeRows.some((grade) => isPreschoolLearningAreaGrade(grade))) {
      return NextResponse.json(
        {
          success: false,
          error: "Subject offerings are not available for Creche, Nursery, KG1, or KG2. Use Preschool Learning Areas on each grade page instead.",
        },
        { status: 400 }
      );
    }
    if (gradeBand !== "custom" && gradeRows.some((grade) => gradeBandForGrade(grade) !== gradeBand)) {
      return NextResponse.json(
        {
          success: false,
          error: `Selected grades must match the ${gradeBand.replace(/_/g, " ")} grade band.`,
        },
        { status: 400 }
      );
    }

    const existingOffering = await SubjectOffering.findOne({
      schoolId: schoolIdObj,
      curriculumCode,
      code: offeringCode,
    });

    if (existingOffering && existingOffering.isActive !== false) {
      return NextResponse.json(
        {
          success: false,
          error: `A subject offering with code ${offeringCode} already exists.`,
        },
        { status: 409 }
      );
    }

    const saved =
      existingOffering && existingOffering.isActive === false
        ? await SubjectOffering.findOneAndUpdate(
            { _id: existingOffering._id, schoolId: schoolIdObj },
            {
              $set: {
                subjectId,
                curriculumCode,
                curriculumId: toObjectIdOrNull(String(body.curriculumId || "")),
                subjectFamily,
                displayName,
                shortName,
                code: offeringCode,
                stage,
                gradeBand,
                gradeIds,
                category,
                lessonNoteTemplateVariant: body.lessonNoteTemplateVariant || "classic",
                reportCardGroup: body.reportCardGroup || null,
                isActive: body.isActive !== false,
              },
            },
            { new: true }
          )
        : await SubjectOffering.create({
      schoolId: schoolIdObj,
      subjectId,
      curriculumCode,
      curriculumId: toObjectIdOrNull(String(body.curriculumId || "")),
      subjectFamily,
      displayName,
      shortName,
      code: offeringCode,
      stage,
      gradeBand,
      gradeIds,
      category,
      lessonNoteTemplateVariant: body.lessonNoteTemplateVariant || "classic",
      reportCardGroup: body.reportCardGroup || null,
      isActive: body.isActive !== false,
    });

    if (!saved?._id) {
      return NextResponse.json(
        { success: false, error: "Failed to save subject offering" },
        { status: 500 }
      );
    }

    await ClassGroup.updateMany(
      { schoolId: schoolIdObj, gradeId: { $nin: gradeIds } },
      { $pull: { subjectOfferingIds: saved._id, subjectIds: subjectId } }
    );

    if (body.autoAssignToMatchingClassGroups === true && gradeIds.length > 0) {
      await ClassGroup.updateMany(
        { schoolId: schoolIdObj, gradeId: { $in: gradeIds } },
        { $addToSet: { subjectOfferingIds: saved._id, subjectIds: subjectId } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: String(saved._id),
          reactivated: existingOffering?.isActive === false,
        },
      },
      { status: existingOffering?.isActive === false ? 200 : 201 }
    );
  } catch (e: unknown) {
    const isDuplicate =
      e instanceof Error &&
      (e.message.includes("E11000") || e.message.includes("duplicate key"));
    const message = isDuplicate
      ? "A subject offering with this code already exists."
      : e instanceof Error
        ? e.message
        : "Failed to create subject offering";
    const status = isDuplicate ? 409 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
