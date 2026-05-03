import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { SchemeItem } from "@/models/SchemeItem";
import { SchoolSettings } from "@/models/SchoolSettings";

function idsEqual(a: mongoose.Types.ObjectId | null | undefined, b: mongoose.Types.ObjectId | null | undefined) {
  if (!a || !b) return false;
  return String(a) === String(b);
}

function schemeMatchesClassAndSubject(
  scheme: Pick<ISchemeOfWork, "gradeId" | "subjectId">,
  classGradeId: mongoose.Types.ObjectId | null | undefined,
  noteSubjectId: mongoose.Types.ObjectId | null | undefined
): boolean {
  if (scheme.gradeId && !idsEqual(scheme.gradeId, classGradeId)) return false;
  if (scheme.subjectId && !idsEqual(scheme.subjectId, noteSubjectId)) return false;
  return true;
}

function teacherMayUseScheme(scheme: ISchemeOfWork, teacherId: mongoose.Types.ObjectId): boolean {
  const status = scheme.status;
  if (status === "active" || status === "approved") return true;
  if (status === "draft" || status === "submitted" || status === "needs_revision") {
    return scheme.ownerTeacherId ? idsEqual(scheme.ownerTeacherId, teacherId) : false;
  }
  return false;
}

export async function resolveLessonNoteSchemeFields(args: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId | null | undefined;
  schemeId: string | null | undefined;
  schemeItemIds: string[] | null | undefined;
}): Promise<
  | {
      ok: true;
      schemeObjectId: mongoose.Types.ObjectId | null;
      schemeItemObjectIds: mongoose.Types.ObjectId[];
    }
  | { ok: false; status: number; error: string }
> {
  const rawSchemeId = args.schemeId;
  const rawItems = args.schemeItemIds;

  if (!rawSchemeId || String(rawSchemeId).trim() === "") {
    if (rawItems && rawItems.length > 0) {
      return { ok: false, status: 400, error: "schemeItemIds require schemeId" };
    }
    return { ok: true, schemeObjectId: null, schemeItemObjectIds: [] };
  }

  if (!mongoose.Types.ObjectId.isValid(rawSchemeId)) {
    return { ok: false, status: 400, error: "Invalid schemeId" };
  }

  const schemeOid = new mongoose.Types.ObjectId(rawSchemeId);
  const uniqueItemStrings = [...new Set((rawItems || []).filter(Boolean))];
  if (uniqueItemStrings.length > 40) {
    return { ok: false, status: 400, error: "At most 40 scheme items may be linked" };
  }

  for (const id of uniqueItemStrings) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { ok: false, status: 400, error: "Invalid schemeItemIds entry" };
    }
  }

  const schemeItemOids = uniqueItemStrings.map((id) => new mongoose.Types.ObjectId(id));

  const [settings, classGroup, scheme] = await Promise.all([
    SchoolSettings.findOne({ schoolId: args.schoolId }).select("academicPlanning").lean(),
    ClassGroup.findById(args.classGroupId).select("gradeId").lean(),
    SchemeOfWork.findOne({ _id: schemeOid, schoolId: args.schoolId }).lean() as Promise<ISchemeOfWork | null>,
  ]);

  const enabled = settings?.academicPlanning?.enableSchemeOfWork ?? false;
  if (!enabled) {
    return {
      ok: false,
      status: 403,
      error: "Scheme of work is not enabled for this school",
    };
  }

  if (!scheme) {
    return { ok: false, status: 404, error: "Scheme not found" };
  }

  if (scheme.status === "archived") {
    return { ok: false, status: 409, error: "Cannot link an archived scheme" };
  }

  if (!teacherMayUseScheme(scheme, args.teacherId)) {
    return { ok: false, status: 403, error: "You cannot use this scheme for lesson notes" };
  }

  const classGradeId = classGroup?.gradeId as mongoose.Types.ObjectId | undefined;
  const noteSubjectId = args.subjectId ?? null;

  if (!schemeMatchesClassAndSubject(scheme, classGradeId ?? null, noteSubjectId)) {
    return {
      ok: false,
      status: 400,
      error: "Scheme grade/subject does not match this class and subject",
    };
  }

  if (schemeItemOids.length === 0) {
    return { ok: true, schemeObjectId: schemeOid, schemeItemObjectIds: [] };
  }

  const count = await SchemeItem.countDocuments({
    schoolId: args.schoolId,
    schemeId: schemeOid,
    _id: { $in: schemeItemOids },
  });

  if (count !== schemeItemOids.length) {
    return {
      ok: false,
      status: 400,
      error: "One or more scheme items are invalid for this scheme",
    };
  }

  return { ok: true, schemeObjectId: schemeOid, schemeItemObjectIds: schemeItemOids };
}

export async function assertLessonNoteRequiresSchemeLink(args: {
  schoolId: mongoose.Types.ObjectId;
  nextStatus: string | undefined;
  schemeIdAfter: mongoose.Types.ObjectId | null | undefined;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const settings = await SchoolSettings.findOne({ schoolId: args.schoolId })
    .select("academicPlanning")
    .lean();
  const requireLink = settings?.academicPlanning?.requireSchemeLinkForLessonNotes ?? false;
  const enabled = settings?.academicPlanning?.enableSchemeOfWork ?? false;
  if (!enabled || !requireLink) return { ok: true };

  const triggers =
    args.nextStatus === "published" ||
    args.nextStatus === "submitted" ||
    args.nextStatus === "approved";

  if (!triggers) return { ok: true };

  if (!args.schemeIdAfter) {
    return {
      ok: false,
      status: 400,
      error: "School policy requires linking this lesson note to a scheme before this step",
    };
  }

  return { ok: true };
}
