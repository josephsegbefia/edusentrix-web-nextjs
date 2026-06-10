// src/app/api/admin/teachers/[id]/subjects/route.ts
import { NextRequest } from "next/server";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { SubjectOffering } from "@/models/SubjectOffering";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Grade } from "@/models/Grade";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function formatGradeBandLabel(gradeBand?: string | null) {
  switch (gradeBand) {
    case "preschool":
      return "Preschool";
    case "lower_primary":
      return "Lower primary";
    case "upper_primary":
      return "Upper primary";
    case "jhs":
      return "JHS";
    case "shs":
      return "SHS";
    default:
      return gradeBand ? String(gradeBand).replace(/_/g, " ") : null;
  }
}

async function loadTeacherOfferings(args: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  teacherSubjectOfferingIds: mongoose.Types.ObjectId[];
}) {
  const assignmentRows = await TeacherAssignment.find({
    schoolId: args.schoolId,
    teacherId: args.teacherId,
    status: "active",
    subjectOfferingId: { $ne: null },
  })
    .select("subjectOfferingId")
    .lean();

  const offeringIdSet = new Set<string>([
    ...args.teacherSubjectOfferingIds.map(String),
    ...assignmentRows
      .map((row) => (row.subjectOfferingId ? String(row.subjectOfferingId) : ""))
      .filter(Boolean),
  ]);

  if (offeringIdSet.size === 0) {
    return [];
  }

  const offerings = await SubjectOffering.find({
    _id: {
      $in: Array.from(offeringIdSet).map((id) => new mongoose.Types.ObjectId(id)),
    },
    schoolId: args.schoolId,
    isActive: true,
  })
    .select(
      "_id subjectId displayName shortName code gradeBand gradeIds isActive"
    )
    .lean();

  const gradeIds = [
    ...new Set(
      offerings.flatMap((row) =>
        Array.isArray(row.gradeIds) ? row.gradeIds.map(String) : []
      )
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const grades =
    gradeIds.length > 0
      ? await Grade.find({ _id: { $in: gradeIds }, schoolId: args.schoolId })
          .select("_id name")
          .lean()
      : [];
  const gradeNameById = new Map(
    grades.map((grade) => [String(grade._id), String(grade.name)])
  );

  return offerings.map((row) => {
    const gradeNames = (Array.isArray(row.gradeIds) ? row.gradeIds : [])
      .map((id) => gradeNameById.get(String(id)))
      .filter((name): name is string => Boolean(name));
    return {
      id: String(row._id),
      subjectId: String(row.subjectId),
      name: String(row.displayName || row.shortName || "Subject"),
      code: row.code ? String(row.code) : null,
      gradeBand: row.gradeBand ? String(row.gradeBand) : null,
      gradeBandLabel: formatGradeBandLabel(row.gradeBand),
      gradeNames,
      isActive: row.isActive !== false,
    };
  });
}

/**
 * GET /api/admin/teachers/:id/subjects
 * Subject offerings linked to this teacher (profile + active assignments).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("subjects");
  await connectToDatabase();

  const { id } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));

  if (!teacherObjId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const teacher = await Teacher.findOne({
    _id: teacherObjId,
    schoolId: schoolIdObj,
  }).select("subjectOfferingIds");

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  const subjects = await loadTeacherOfferings({
    schoolId: schoolIdObj,
    teacherId: teacherObjId,
    teacherSubjectOfferingIds: (teacher.subjectOfferingIds ||
      []) as mongoose.Types.ObjectId[],
  });

  return Response.json({
    success: true,
    data: subjects,
  });
}

/**
 * POST /api/admin/teachers/:id/subjects
 * Add subject offering(s) to a teacher.
 * Body: { subjectOfferingIds: string[] }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId: adminUserId } =
    await requireSchoolAdminOrDelegatedAnyPermission(["subjects.edit"]);
  await connectToDatabase();

  const { id } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));

  if (!teacherObjId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  let body: { subjectOfferingIds?: unknown; subjectIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawOfferingIds = Array.isArray(body.subjectOfferingIds)
    ? body.subjectOfferingIds
    : Array.isArray(body.subjectIds)
      ? body.subjectIds
      : [];

  const subjectOfferingIds = rawOfferingIds
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (subjectOfferingIds.length === 0) {
    return Response.json(
      { error: "subjectOfferingIds must be a non-empty array" },
      { status: 400 }
    );
  }

  const teacher = await Teacher.findOne({
    _id: teacherObjId,
    schoolId: schoolIdObj,
  });

  if (!teacher) {
    return Response.json({ error: "Teacher not found" }, { status: 404 });
  }

  const existingOfferingIds = new Set(
    (teacher.subjectOfferingIds || []).map((oid: mongoose.Types.ObjectId) =>
      String(oid)
    )
  );

  const validOfferingIds: mongoose.Types.ObjectId[] = [];
  const validSubjectIds: mongoose.Types.ObjectId[] = [];
  const addedSubjectNames: string[] = [];

  for (const offeringId of subjectOfferingIds) {
    const offeringObjId = toObjectIdOrNull(offeringId);
    if (!offeringObjId) continue;
    if (existingOfferingIds.has(String(offeringObjId))) continue;

    const offering = await SubjectOffering.findOne({
      _id: offeringObjId,
      schoolId: schoolIdObj,
      isActive: true,
    })
      .select("_id subjectId displayName shortName")
      .lean();

    if (!offering) continue;

    validOfferingIds.push(offeringObjId);
    validSubjectIds.push(
      offering.subjectId instanceof mongoose.Types.ObjectId
        ? offering.subjectId
        : new mongoose.Types.ObjectId(String(offering.subjectId))
    );
    addedSubjectNames.push(
      String(offering.displayName || offering.shortName || "Subject")
    );
    existingOfferingIds.add(String(offeringObjId));
  }

  if (validOfferingIds.length === 0) {
    return Response.json({
      success: true,
      message: "No new subject offerings to add",
      data: { added: 0, subjectNames: [] },
    });
  }

  await Teacher.findByIdAndUpdate(teacherObjId, {
    $addToSet: {
      subjectOfferingIds: { $each: validOfferingIds },
      subjectIds: { $each: validSubjectIds },
    },
  });

  await logTeacherActivity({
    teacherId: String(teacher._id),
    schoolId: schoolIdObj,
    type: "assignment.created",
    title: "Subject offerings assigned",
    description: `Added subject offerings: ${addedSubjectNames.join(", ")}`,
    metadata: {
      subjectOfferingIds: validOfferingIds.map((oid) => String(oid)),
      subjectNames: addedSubjectNames,
      assignedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: `Added ${validOfferingIds.length} subject offering(s)`,
    data: {
      added: validOfferingIds.length,
      subjectNames: addedSubjectNames,
    },
  });
}
