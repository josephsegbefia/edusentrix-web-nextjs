import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { CurriculumNode, type ICurriculumNode, type CurriculumNodeKind } from "@/models/CurriculumNode";

function parseId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

const PatchSchema = z.object({
  parentNodeId: z.string().nullable().optional(),
  kind: z.enum(["strand", "sub_strand", "topic", "sub_topic", "objective"]).optional(),
  title: z.string().trim().min(1).max(260).optional(),
  code: z.string().trim().max(120).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

const KINDS: CurriculumNodeKind[] = [
  "strand",
  "sub_strand",
  "topic",
  "sub_topic",
  "objective",
];

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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const nodeId = parseId(id);
    if (!nodeId) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const existing = (await CurriculumNode.findOne({
      _id: nodeId,
      schoolId: admin.schoolId,
    }).lean()) as ICurriculumNode | null;
    if (!existing) {
      return Response.json({ success: false, error: "Node not found" }, { status: 404 });
    }

    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const setData: Record<string, unknown> = {};

    if (parsed.data.title !== undefined) setData.title = parsed.data.title.trim();
    if (parsed.data.order !== undefined) setData.order = parsed.data.order;
    if (parsed.data.kind !== undefined) {
      if (!KINDS.includes(parsed.data.kind)) {
        return Response.json({ success: false, error: "Invalid kind" }, { status: 400 });
      }
      setData.kind = parsed.data.kind;
    }

    if (parsed.data.code !== undefined) {
      if (parsed.data.code === null || parsed.data.code === "") {
        setData.code = null;
      } else {
        setData.code = parsed.data.code.trim();
      }
    }

    if (parsed.data.parentNodeId !== undefined) {
      if (parsed.data.parentNodeId === null || parsed.data.parentNodeId === "") {
        setData.parentNodeId = null;
      } else {
        const p = parseId(parsed.data.parentNodeId);
        if (!p) {
          return Response.json({ success: false, error: "Invalid parentNodeId" }, { status: 400 });
        }
        if (p.equals(nodeId)) {
          return Response.json({ success: false, error: "Node cannot be its own parent" }, { status: 400 });
        }
        const parent = await CurriculumNode.findOne({
          _id: p,
          schoolId: admin.schoolId,
          curriculumSubjectId: existing.curriculumSubjectId,
        })
          .select("_id")
          .lean();
        if (!parent) {
          return Response.json({ success: false, error: "Parent node not found" }, { status: 404 });
        }
        // Prevent cycles: walk ancestors from parent
        let walk: mongoose.Types.ObjectId | null = p;
        const guard = 200;
        let steps = 0;
        while (walk && steps < guard) {
          if (walk.equals(nodeId)) {
            return Response.json(
              { success: false, error: "That parent would create a cycle" },
              { status: 400 }
            );
          }
          const next = (await CurriculumNode.findById(walk).select("parentNodeId").lean()) as
            | { parentNodeId?: mongoose.Types.ObjectId | null }
            | null;
          walk = next?.parentNodeId ?? null;
          steps += 1;
        }
        setData.parentNodeId = p;
      }
    }

    if (Object.keys(setData).length === 0) {
      return Response.json({ success: true, data: { node: serializeNode(existing) } });
    }

    const updated = await CurriculumNode.findOneAndUpdate(
      { _id: nodeId, schoolId: admin.schoolId },
      { $set: setData },
      { new: true }
    ).lean();

    return Response.json({
      success: true,
      data: { node: serializeNode(updated as ICurriculumNode) },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update node" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const nodeId = parseId(id);
    if (!nodeId) {
      return Response.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const existing = (await CurriculumNode.findOne({
      _id: nodeId,
      schoolId: admin.schoolId,
    })
      .select("_id")
      .lean()) as { _id: mongoose.Types.ObjectId } | null;
    if (!existing) {
      return Response.json({ success: false, error: "Node not found" }, { status: 404 });
    }

    const childCount = await CurriculumNode.countDocuments({
      schoolId: admin.schoolId,
      parentNodeId: nodeId,
    });
    if (childCount > 0) {
      return Response.json(
        {
          success: false,
          error: "Remove or reassign child nodes before deleting this item",
        },
        { status: 409 }
      );
    }

    await CurriculumNode.deleteOne({ _id: nodeId, schoolId: admin.schoolId });

    return Response.json({ success: true, data: { deleted: true } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete node" },
      { status: 500 }
    );
  }
}
