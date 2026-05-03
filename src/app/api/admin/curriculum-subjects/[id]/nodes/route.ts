import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { loadCurriculumNodesForPlanning } from "@/lib/schemes/curriculum-planning-loaders";
import { CurriculumNode, type ICurriculumNode } from "@/models/CurriculumNode";
import { CurriculumSubject, type ICurriculumSubject } from "@/models/CurriculumSubject";

function parseId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

const CreateSchema = z.object({
  parentNodeId: z.string().nullable().optional(),
  kind: z.enum(["strand", "sub_strand", "topic", "sub_topic", "objective"]),
  title: z.string().trim().min(1).max(260),
  code: z.string().trim().max(120).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const curriculumSubjectId = parseId(id);
    if (!curriculumSubjectId) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const subjectRow = (await CurriculumSubject.findOne({
      _id: curriculumSubjectId,
      schoolId: admin.schoolId,
    }).lean()) as ICurriculumSubject | null;
    if (!subjectRow) {
      return Response.json({ success: false, error: "Curriculum subject not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    const nodes = await loadCurriculumNodesForPlanning({
      schoolId: admin.schoolId,
      curriculumId: subjectRow.curriculumId,
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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const curriculumSubjectId = parseId(id);
    if (!curriculumSubjectId) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const subjectRow = (await CurriculumSubject.findOne({
      _id: curriculumSubjectId,
      schoolId: admin.schoolId,
    }).lean()) as ICurriculumSubject | null;
    if (!subjectRow) {
      return Response.json({ success: false, error: "Curriculum subject not found" }, { status: 404 });
    }

    const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let parentNodeId: mongoose.Types.ObjectId | null = null;
    if (parsed.data.parentNodeId) {
      const p = parseId(parsed.data.parentNodeId);
      if (!p) {
        return Response.json({ success: false, error: "Invalid parentNodeId" }, { status: 400 });
      }
      const parent = await CurriculumNode.findOne({
        _id: p,
        schoolId: admin.schoolId,
        curriculumSubjectId,
      })
        .select("_id")
        .lean();
      if (!parent) {
        return Response.json({ success: false, error: "Parent node not found" }, { status: 404 });
      }
      parentNodeId = p;
    }

    let order = parsed.data.order;
    if (order === undefined) {
      const match: Record<string, unknown> = {
        schoolId: admin.schoolId,
        curriculumSubjectId,
      };
      if (parentNodeId) {
        match.parentNodeId = parentNodeId;
      } else {
        match.$or = [{ parentNodeId: null }, { parentNodeId: { $exists: false } }];
      }
      const last = await CurriculumNode.findOne(match).sort({ order: -1 }).select("order").lean();
      order = last ? (last as { order: number }).order + 1 : 0;
    }

    const code =
      parsed.data.code === undefined || parsed.data.code === null || parsed.data.code === ""
        ? null
        : parsed.data.code.trim();

    const created = await CurriculumNode.create({
      schoolId: admin.schoolId,
      curriculumId: subjectRow.curriculumId,
      curriculumSubjectId,
      parentNodeId,
      kind: parsed.data.kind,
      title: parsed.data.title.trim(),
      code,
      order,
    });

    return Response.json({
      success: true,
      data: { node: serializeNode(created.toObject() as ICurriculumNode) },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create node" },
      { status: 500 }
    );
  }
}
