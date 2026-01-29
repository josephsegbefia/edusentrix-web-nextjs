import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Escalation } from "@/models/Escalation";
import { Student } from "@/models/Student";

const EscalationUpdateSchema = z.object({
  type: z.enum(["discipline", "academic", "welfare", "other"]).optional(),
  title: z.string().min(1).max(160).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(["open", "in_review", "resolved", "closed"]).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const { id } = await ctx.params;
    const escalationId = toObjectIdOrNull(id);
    if (!escalationId) {
      return Response.json({ success: false, error: "Invalid escalation id" }, { status: 400 });
    }

    const query: Record<string, unknown> = { _id: escalationId, schoolId: context.schoolId };
    if (!context.isAdmin) query.teacherId = context.teacherId;

    const escalation = await Escalation.findOne(query).lean();
    if (!escalation) {
      return Response.json({ success: false, error: "Escalation not found" }, { status: 404 });
    }

    const student = escalation.studentId
      ? await Student.findById(escalation.studentId).select("_id firstName lastName admissionNo").lean()
      : null;

    return Response.json({
      success: true,
      data: {
        escalation: {
          id: String(escalation._id),
          type: escalation.type,
          title: escalation.title,
          description: escalation.description,
          status: escalation.status,
          student: student
            ? {
                id: String(student._id),
                name: `${student.firstName} ${student.lastName}`.trim(),
                admissionNo: student.admissionNo || undefined,
              }
            : null,
          createdAt: escalation.createdAt ? escalation.createdAt.toISOString() : null,
          resolvedAt: escalation.resolvedAt ? escalation.resolvedAt.toISOString() : null,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch escalation:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch escalation";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.escalationsCreate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const escalationId = toObjectIdOrNull(id);
    if (!escalationId) {
      return Response.json({ success: false, error: "Invalid escalation id" }, { status: 400 });
    }

    const query: Record<string, unknown> = { _id: escalationId, schoolId: context.schoolId };
    if (!context.isAdmin) query.teacherId = context.teacherId;

    const escalation = await Escalation.findOne(query).lean();
    if (!escalation) {
      return Response.json({ success: false, error: "Escalation not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = EscalationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      type: parsed.data.type ?? escalation.type,
      title: parsed.data.title ?? escalation.title,
      description: parsed.data.description ?? escalation.description,
      status: parsed.data.status ?? escalation.status,
    };

    if (update.status === "resolved" || update.status === "closed") {
      update.resolvedAt = new Date();
      update.resolvedBy = context.userId;
    }

    await Escalation.updateOne({ _id: escalationId }, { $set: update });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update escalation:", e);
    const message = e instanceof Error ? e.message : "Failed to update escalation";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
