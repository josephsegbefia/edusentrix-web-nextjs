/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import {
  getPreschoolLearningAreaNames,
  isPreschoolLearningAreaGrade,
} from "@/constants/curriculum-subject-templates";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";

type RouteParams = { params: Promise<{ gradeId: string }> };

function toObjectId(value: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(value);
  } catch {
    return null;
  }
}

function cleanNames(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const names: string[] = [];

  for (const item of input) {
    if (typeof item !== "string") continue;
    const name = item.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names;
}

async function getPreschoolGradeOrResponse(
  gradeId: string,
  schoolId: mongoose.Types.ObjectId
) {
  const gradeIdObj = toObjectId(gradeId);
  if (!gradeIdObj) {
    return {
      response: NextResponse.json(
        { success: false, error: "Invalid grade ID" },
        { status: 400 }
      ),
    };
  }

  const grade = await Grade.findOne({ _id: gradeIdObj, schoolId }).lean();
  if (!grade) {
    return {
      response: NextResponse.json(
        { success: false, error: "Grade not found" },
        { status: 404 }
      ),
    };
  }

  if (!isPreschoolLearningAreaGrade(grade)) {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: "Learning areas are only available for Creche, Nursery, KG1, and KG2.",
        },
        { status: 400 }
      ),
    };
  }

  return { gradeIdObj, grade };
}

async function buildLearningAreaPayload(
  schoolId: mongoose.Types.ObjectId,
  gradeIdObj: mongoose.Types.ObjectId,
  grade: any
) {
  const classes = await ClassGroup.find({
    schoolId,
    gradeId: gradeIdObj,
    isActive: true,
  })
    .populate("subjectIds", "name code category")
    .lean();

  const totalClasses = classes.length;
  const recommendedSet = new Set(
    getPreschoolLearningAreaNames(grade).map((name) => name.toLowerCase())
  );
  const subjectMap = new Map<
    string,
    { id: string; name: string; classesWithSubject: number }
  >();

  for (const cls of classes) {
    const subjectIds = (cls as any).subjectIds ?? [];
    for (const subject of subjectIds) {
      if (!subject?._id) continue;
      const subjectName = typeof subject.name === "string" ? subject.name.trim() : "";
      const isLearningArea =
        subject.category === "learning_area" ||
        (subjectName.length > 0 && recommendedSet.has(subjectName.toLowerCase()));
      if (!isLearningArea) continue;

      const id = String(subject._id);
      const existing = subjectMap.get(id);
      if (existing) {
        existing.classesWithSubject += 1;
      } else {
        subjectMap.set(id, {
          id,
          name: subject.name ?? "Unknown",
          classesWithSubject: 1,
        });
      }
    }
  }

  const assigned = [...subjectMap.values()]
    .map((subject) => ({
      ...subject,
      classesWithoutSubject: totalClasses - subject.classesWithSubject,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    grade: {
      id: String(grade._id),
      name: grade.name,
      code: grade.code ?? null,
      stage: grade.stage ?? null,
    },
    label: "Learning areas",
    recommended: getPreschoolLearningAreaNames(grade),
    assigned,
    classCount: totalClasses,
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("grades");
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { gradeId } = await params;
    const result = await getPreschoolGradeOrResponse(gradeId, schoolIdObj);
    if ("response" in result) return result.response;

    const data = await buildLearningAreaPayload(
      schoolIdObj,
      result.gradeIdObj,
      result.grade
    );

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message =
      e instanceof Error ? e.message : "Failed to fetch learning areas";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "grades.edit",
      "subjects.edit",
    ]);
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { gradeId } = await params;
    const result = await getPreschoolGradeOrResponse(gradeId, schoolIdObj);
    if ("response" in result) return result.response;

    const body = (await req.json()) as { names?: unknown; replace?: unknown };
    const names = cleanNames(body.names);
    if (!names.length) {
      return NextResponse.json(
        { success: false, error: "Select or create at least one learning area." },
        { status: 400 }
      );
    }

    const subjectIds: mongoose.Types.ObjectId[] = [];
    for (const name of names) {
      const existing = await Subject.findOne({ schoolId: schoolIdObj, name })
        .collation({ locale: "en", strength: 2 })
        .lean();

      if (existing?._id) {
        subjectIds.push(existing._id as mongoose.Types.ObjectId);
        continue;
      }

      const created = await Subject.create({
        schoolId: schoolIdObj,
        name,
        code: null,
        category: "learning_area",
        isActive: true,
      });
      subjectIds.push(created._id);
    }

    const update =
      body.replace === false
        ? { $addToSet: { subjectIds: { $each: subjectIds } } }
        : { $set: { subjectIds } };

    const updateResult = await ClassGroup.updateMany(
      {
        schoolId: schoolIdObj,
        gradeId: result.gradeIdObj,
        isActive: true,
      },
      update
    );

    const data = await buildLearningAreaPayload(
      schoolIdObj,
      result.gradeIdObj,
      result.grade
    );

    return NextResponse.json({
      success: true,
      data,
      updatedClassCount: updateResult.modifiedCount ?? 0,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message =
      e instanceof Error ? e.message : "Failed to save learning areas";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "grades.edit",
      "subjects.edit",
    ]);
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { gradeId } = await params;
    const result = await getPreschoolGradeOrResponse(gradeId, schoolIdObj);
    if ("response" in result) return result.response;

    const updateResult = await ClassGroup.updateMany(
      {
        schoolId: schoolIdObj,
        gradeId: result.gradeIdObj,
        isActive: true,
      },
      { $set: { subjectIds: [] } }
    );

    const data = await buildLearningAreaPayload(
      schoolIdObj,
      result.gradeIdObj,
      result.grade
    );

    return NextResponse.json({
      success: true,
      data,
      clearedClassCount: updateResult.modifiedCount ?? 0,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message =
      e instanceof Error ? e.message : "Failed to clear learning areas";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
