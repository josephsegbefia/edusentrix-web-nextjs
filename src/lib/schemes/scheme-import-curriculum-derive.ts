import mongoose from "mongoose";
import type { ISchemeImportJob } from "@/models/SchemeImportJob";
import { Curriculum, type ICurriculum } from "@/models/Curriculum";
import { CurriculumNode, type ICurriculumNode, type CurriculumNodeKind } from "@/models/CurriculumNode";
import { CurriculumSubject, type ICurriculumSubject } from "@/models/CurriculumSubject";

type ImportRow = ISchemeImportJob["parsedRows"][number];

type DeriveInput = {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  gradeId: mongoose.Types.ObjectId;
  rows: ImportRow[];
};

type DeriveResult = {
  curriculumId: mongoose.Types.ObjectId;
  curriculumSubjectId: mongoose.Types.ObjectId;
  rowNodeIds: Map<number, mongoose.Types.ObjectId[]>;
};

function normalizeTitle(value: string | null | undefined): string | null {
  const title = value?.replace(/\s+/g, " ").trim();
  return title && title.length >= 2 ? title.slice(0, 260) : null;
}

function codeFromTitle(prefix: string, title: string) {
  const body = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${prefix}-${body || "node"}`.slice(0, 120);
}

async function resolveCurriculum(input: DeriveInput): Promise<ICurriculum> {
  const active = (await Curriculum.findOne({
    schoolId: input.schoolId,
    status: "active",
  })
    .sort({ updatedAt: -1 })
    .lean()) as ICurriculum | null;
  if (active) return active;

  const existing = await Curriculum.findOne({
    schoolId: input.schoolId,
    code: "scheme-learning-import",
  });
  if (existing) return existing.toObject();

  const created = await Curriculum.create({
    schoolId: input.schoolId,
    title: "Imported Schemes of Learning",
    code: "scheme-learning-import",
    description: "Auto-created from imported Schemes of Learning.",
    status: "active",
    createdByUserId: input.userId,
    updatedByUserId: input.userId,
  });
  return created.toObject();
}

async function resolveCurriculumSubject(input: {
  schoolId: mongoose.Types.ObjectId;
  curriculumId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  gradeId: mongoose.Types.ObjectId;
}): Promise<ICurriculumSubject> {
  const existing = await CurriculumSubject.findOne({
    schoolId: input.schoolId,
    curriculumId: input.curriculumId,
    subjectId: input.subjectId,
    gradeId: input.gradeId,
  });
  if (existing) return existing.toObject();

  const created = await CurriculumSubject.create({
    schoolId: input.schoolId,
    curriculumId: input.curriculumId,
    subjectId: input.subjectId,
    gradeId: input.gradeId,
    order: 0,
  });
  return created.toObject();
}

async function findOrCreateNode(input: {
  schoolId: mongoose.Types.ObjectId;
  curriculumId: mongoose.Types.ObjectId;
  curriculumSubjectId: mongoose.Types.ObjectId;
  parentNodeId: mongoose.Types.ObjectId | null;
  kind: CurriculumNodeKind;
  title: string;
  order: number;
  metadata?: Record<string, unknown>;
}): Promise<ICurriculumNode> {
  const existing = await CurriculumNode.findOne({
    schoolId: input.schoolId,
    curriculumId: input.curriculumId,
    curriculumSubjectId: input.curriculumSubjectId,
    parentNodeId: input.parentNodeId,
    kind: input.kind,
    title: input.title,
  });
  if (existing) return existing.toObject();

  const created = await CurriculumNode.create({
    schoolId: input.schoolId,
    curriculumId: input.curriculumId,
    curriculumSubjectId: input.curriculumSubjectId,
    parentNodeId: input.parentNodeId,
    kind: input.kind,
    title: input.title,
    code: codeFromTitle(input.kind, input.title),
    order: input.order,
    metadata: input.metadata ?? null,
  });
  return created.toObject();
}

export async function deriveCurriculumStructureFromSchemeImport(input: DeriveInput): Promise<DeriveResult> {
  const curriculum = await resolveCurriculum(input);
  const curriculumSubject = await resolveCurriculumSubject({
    schoolId: input.schoolId,
    curriculumId: curriculum._id,
    subjectId: input.subjectId,
    gradeId: input.gradeId,
  });

  const rowNodeIds = new Map<number, mongoose.Types.ObjectId[]>();
  let strandOrder = 0;
  let subStrandOrder = 0;
  let objectiveOrder = 0;

  for (const row of input.rows) {
    if (row.skipped || row.errors.length > 0) continue;
    const nodeIds: mongoose.Types.ObjectId[] = [];
    const strandTitle = normalizeTitle(row.strand);
    const subStrandTitle = normalizeTitle(row.subStrand);
    const objectiveTitle = normalizeTitle(row.contentStandard || row.indicators?.[0] || row.title);

    let parentNodeId: mongoose.Types.ObjectId | null = null;
    if (strandTitle) {
      const node = await findOrCreateNode({
        schoolId: input.schoolId,
        curriculumId: curriculum._id,
        curriculumSubjectId: curriculumSubject._id,
        parentNodeId: null,
        kind: "strand",
        title: strandTitle,
        order: strandOrder,
        metadata: { source: "scheme_import" },
      });
      parentNodeId = node._id;
      nodeIds.push(node._id);
      strandOrder += 1;
    }

    if (subStrandTitle) {
      const node = await findOrCreateNode({
        schoolId: input.schoolId,
        curriculumId: curriculum._id,
        curriculumSubjectId: curriculumSubject._id,
        parentNodeId,
        kind: "sub_strand",
        title: subStrandTitle,
        order: subStrandOrder,
        metadata: { source: "scheme_import" },
      });
      parentNodeId = node._id;
      nodeIds.push(node._id);
      subStrandOrder += 1;
    }

    if (objectiveTitle) {
      const node = await findOrCreateNode({
        schoolId: input.schoolId,
        curriculumId: curriculum._id,
        curriculumSubjectId: curriculumSubject._id,
        parentNodeId,
        kind: "objective",
        title: objectiveTitle,
        order: objectiveOrder,
        metadata: {
          source: "scheme_import",
          indicators: row.indicators || [],
        },
      });
      nodeIds.push(node._id);
      objectiveOrder += 1;
    }

    rowNodeIds.set(row.rowIndex, nodeIds);
  }

  return {
    curriculumId: curriculum._id,
    curriculumSubjectId: curriculumSubject._id,
    rowNodeIds,
  };
}
