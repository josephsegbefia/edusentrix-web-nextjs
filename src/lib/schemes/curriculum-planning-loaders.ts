import "server-only";
import mongoose from "mongoose";
import { CurriculumNode, type ICurriculumNode } from "@/models/CurriculumNode";
import { CurriculumSubject } from "@/models/CurriculumSubject";
import type { ISchemeOfWork } from "@/models/SchemeOfWork";

export async function resolveCurriculumSubjectIdForScheme(args: {
  scheme: ISchemeOfWork;
  schoolId: mongoose.Types.ObjectId;
}): Promise<mongoose.Types.ObjectId | null> {
  const { scheme, schoolId } = args;
  if (scheme.curriculumSubjectId) return scheme.curriculumSubjectId;
  if (!scheme.curriculumId || !scheme.subjectId) return null;

  const base = {
    schoolId,
    curriculumId: scheme.curriculumId,
    subjectId: scheme.subjectId,
  };

  if (scheme.gradeId) {
    const matchGrade = await CurriculumSubject.findOne({
      ...base,
      gradeId: scheme.gradeId,
    })
      .select("_id")
      .lean();
    if (matchGrade) return matchGrade._id;
  }

  const fallback = await CurriculumSubject.findOne({
    ...base,
    $or: [{ gradeId: null }, { gradeId: { $exists: false } }],
  })
    .sort({ order: 1 })
    .select("_id")
    .lean();

  return fallback?._id ?? null;
}

export async function loadCurriculumNodesForPlanning(args: {
  schoolId: mongoose.Types.ObjectId;
  curriculumId: mongoose.Types.ObjectId;
  curriculumSubjectId: mongoose.Types.ObjectId;
  q?: string | null;
  limit?: number;
}): Promise<ICurriculumNode[]> {
  const lim = Math.min(Math.max(args.limit ?? 400, 1), 500);
  const query: Record<string, unknown> = {
    schoolId: args.schoolId,
    curriculumId: args.curriculumId,
    curriculumSubjectId: args.curriculumSubjectId,
  };
  const raw = args.q?.trim();
  if (raw) {
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.title = new RegExp(esc, "i");
  }
  return (await CurriculumNode.find(query)
    .sort({ order: 1 })
    .limit(lim)
    .lean()) as ICurriculumNode[];
}
