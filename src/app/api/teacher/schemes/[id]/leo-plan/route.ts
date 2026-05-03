import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { assertAiSchemeDraftingEnabled } from "@/lib/schemes/scheme-import-gate";
import {
  loadCurriculumNodesForPlanning,
  resolveCurriculumSubjectIdForScheme,
} from "@/lib/schemes/curriculum-planning-loaders";
import { runLeoSchemePlan } from "@/lib/schemes/scheme-leo-plan";
import { LEO_SCHEME_PLAN_MODES, type LeoSchemePlanMode } from "@/types/scheme-leo";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { SchemeItem, type ISchemeItem } from "@/models/SchemeItem";
import { writeRetryableAuditEvent } from "@/lib/audit/writeRetryableAuditEvent";
import {
  buildSchoolUserAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";

const BodySchema = z.object({
  mode: z.custom<LeoSchemePlanMode>(
    (val) => typeof val === "string" && (LEO_SCHEME_PLAN_MODES as readonly string[]).includes(val),
    { message: "Invalid planning mode" }
  ),
  nodeSearch: z.string().max(200).optional(),
});

const MODES_NEEDING_NODES: LeoSchemePlanMode[] = ["draft_from_curriculum", "uncovered"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacherCtx = await requireTeacher();
    if (!can(teacherCtx.permissions, PERMISSIONS.schemeOfWorkRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await connectToDatabase();
    const gate = await assertAiSchemeDraftingEnabled(teacherCtx.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid scheme id" }, { status: 400 });
    }
    const schemeId = new mongoose.Types.ObjectId(id);

    const scheme = (await SchemeOfWork.findOne({
      _id: schemeId,
      schoolId: teacherCtx.schoolId,
    }).lean()) as ISchemeOfWork | null;
    if (!scheme) {
      return Response.json({ success: false, error: "Scheme not found" }, { status: 404 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const mode = parsed.data.mode;

    const subjectSubjectId = await resolveCurriculumSubjectIdForScheme({
      scheme,
      schoolId: teacherCtx.schoolId,
    });

    let curriculumNodes: Awaited<ReturnType<typeof loadCurriculumNodesForPlanning>> = [];
    if (scheme.curriculumId && subjectSubjectId) {
      curriculumNodes = await loadCurriculumNodesForPlanning({
        schoolId: teacherCtx.schoolId,
        curriculumId: scheme.curriculumId,
        curriculumSubjectId: subjectSubjectId,
        q: parsed.data.nodeSearch ?? null,
      });
    }

    if (MODES_NEEDING_NODES.includes(mode)) {
      if (!scheme.curriculumId || !subjectSubjectId) {
        return Response.json(
          {
            success: false,
            error:
              "Link this scheme to a curriculum and matching subject (and grade if applicable) before using this mode.",
          },
          { status: 422 }
        );
      }
      if (curriculumNodes.length === 0) {
        return Response.json(
          {
            success: false,
            error:
              "No curriculum nodes found for this curriculum subject. Add nodes under Admin curriculum setup first.",
          },
          { status: 422 }
        );
      }
    }

    const items = (await SchemeItem.find({ schoolId: teacherCtx.schoolId, schemeId })
      .sort({ weekNumber: 1, sequence: 1, createdAt: 1 })
      .lean()) as ISchemeItem[];

    const ai = await runLeoSchemePlan({
      mode,
      scheme,
      items,
      curriculumNodes,
      schoolId: teacherCtx.schoolId,
    });

    if (!ai.ok) {
      return Response.json({ success: false, error: ai.error }, { status: 502 });
    }

    try {
      await writeRetryableAuditEvent({
        actionCode: "academic.leo_scheme_plan.requested",
        scopeType: "school",
        scopeId: String(teacherCtx.schoolId),
        result: "succeeded",
        target: {
          targetEntityType: "SchemeOfWork",
          targetEntityId: schemeId,
        },
        context: buildSchoolUserAuditContext(req, {
          userId: teacherCtx.userId,
          schoolId: teacherCtx.schoolId,
          actorRole: "teacher",
          idempotencyKey: resolveAuditIdempotencyKey(
            req,
            `leo.scheme_plan:${String(schemeId)}:${mode}:${Date.now()}`
          ),
        }),
        payload: {
          metadata: {
            mode,
            suggestedRowCount: ai.result.suggestedRows.length,
            curriculumNodeCount: curriculumNodes.length,
          },
        },
      });
    } catch (e) {
      console.error("[leo-plan] audit failed:", e);
    }

    return Response.json({
      success: true,
      data: { plan: ai.result },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Leo planner failed" },
      { status: 500 }
    );
  }
}
