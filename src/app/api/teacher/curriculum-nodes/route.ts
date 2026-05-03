import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Curriculum } from "@/models/Curriculum";
import { CurriculumSubject } from "@/models/CurriculumSubject";
import { loadCurriculumNodesForPlanning } from "@/lib/schemes/curriculum-planning-loaders";
import type { ICurriculumNode } from "@/models/CurriculumNode";

function serializeNode(row: ICurriculumNode) {
  return {
    id: String(row._id),
    curriculumId: String(row.curriculumId),
    curriculumSubjectId: String(row.curriculumSubjectId),
    parentNodeId: row.parentNodeId ? String(row.parentNodeId) : null,
    kind: row.kind,
    title: row.title,
    code: row.code ?? null,
    order: row.order,
  };
}

export async function GET(req: Request) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.curriculumFrameworkRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const curriculumIdRaw = searchParams.get("curriculumId");
    const curriculumSubjectIdRaw = searchParams.get("curriculumSubjectId");
    const q = searchParams.get("q");

    if (!curriculumIdRaw || !mongoose.Types.ObjectId.isValid(curriculumIdRaw)) {
      return Response.json({ success: false, error: "curriculumId is required" }, { status: 400 });
    }
    if (!curriculumSubjectIdRaw || !mongoose.Types.ObjectId.isValid(curriculumSubjectIdRaw)) {
      return Response.json(
        { success: false, error: "curriculumSubjectId is required" },
        { status: 400 }
      );
    }

    const curriculumId = new mongoose.Types.ObjectId(curriculumIdRaw);
    const curriculumSubjectId = new mongoose.Types.ObjectId(curriculumSubjectIdRaw);

    const [curriculum, subjectRow] = await Promise.all([
      Curriculum.findOne({ _id: curriculumId, schoolId: ctx.schoolId }).select("_id").lean(),
      CurriculumSubject.findOne({
        _id: curriculumSubjectId,
        schoolId: ctx.schoolId,
        curriculumId,
      })
        .select("_id")
        .lean(),
    ]);
    if (!curriculum) {
      return Response.json({ success: false, error: "Curriculum not found" }, { status: 404 });
    }
    if (!subjectRow) {
      return Response.json({ success: false, error: "Curriculum subject not found" }, { status: 404 });
    }

    const nodes = await loadCurriculumNodesForPlanning({
      schoolId: ctx.schoolId,
      curriculumId,
      curriculumSubjectId,
      q,
    });

    return Response.json({
      success: true,
      data: { nodes: nodes.map(serializeNode) },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to list nodes" },
      { status: 500 }
    );
  }
}
